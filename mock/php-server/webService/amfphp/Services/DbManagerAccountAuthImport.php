<?php
require_once __DIR__ . '/AuthSession.php';
require_once __DIR__ . '/../../lib/TInetUserAuthWriter.php';

// アカウント認証のExcel取り込み適用。通常アカウント・DIAG用アカウント・権限
// （t_user_authority_manage）をまたいで書き込む「複数テーブルに波及する操作」なので、
// 引数でテーブルを選ばず、専用のサービス・メソッド名で表現する（2026-10-09方針）。
//
// 【原子性の限界】t_user_authority_manage は MyISAM（トランザクション非対応）。
// 途中で失敗しても巻き戻せない。Express側は毎回DBを読み直して差分を再計算するため、
// 失敗後に同じファイルをもう一度取り込めば残りが自然に補われる（冪等）。
// ここでは最初の失敗で即座に打ち切り、何件目で失敗したかをerrormsgに入れて返す。
//
// 権限は ALL_MANUAL / HTML_BROWSING の2種類だけを扱い、三者択一（なし／どちらか一方）に
// 揃える。それ以外の権限行には一切触れない。外すときは行を消さず applicate = 0 にする
// （UNIQUE KEY (authority_id, account_type, account_id) があるため、再付与は行の再利用）。
// account_type は通常/DIAGを区別する列ではない（ユーザー確認 2026-10-21）。旧PHPが
// 電子マニュアルアカウントの権限行に使っていた 0 を固定で使う。

if (!defined('RESULT_SUCCESS')) define('RESULT_SUCCESS', 0);
if (!defined('RESULT_FAILURE')) define('RESULT_FAILURE', -1);
if (!defined('ERROR_LOGIN_STATE_MISSMATCH')) define('ERROR_LOGIN_STATE_MISSMATCH', 7);

class DbManagerAccountAuthImport
{
    private $normalTable = 't_inet_user_auth';
    private $diagTable = 't_inet_user_auth_ds3';
    private $managedAuthorities = array('ALL_MANUAL', 'HTML_BROWSING');
    private $accountType = 0;

    // 通常アカウントに付いている管理対象の権限（ALL_MANUAL/HTML_BROWSING）の一覧。
    // applicate=0（外した行）も含めて返す（Express側が「今どれが有効か」を判断する）
    public function loadAuthorities($userid = null, $key = null, $target = 0)
    {
        $auth = new AuthSession();
        if (!$auth->checkLogin($userid, $key)) {
            return array('code' => RESULT_FAILURE, 'errorcode' => ERROR_LOGIN_STATE_MISSMATCH, 'errormsg' => "don't login");
        }
        $db = $auth->connectionDb($target);
        $rows = $db->query(
            "select u.account_id as account_id, a.authority_type as authority_type, u.applicate as applicate
               from t_user_authority_manage u
               join t_authority_manage a on a.id = u.authority_id
              where u.account_type = ? and a.authority_type in ('ALL_MANUAL', 'HTML_BROWSING')
              order by u.account_id",
            array($this->accountType)
        );
        $err = $db->errMsg;
        $db->close();
        if ($rows === false || $rows === null) {
            return array('code' => RESULT_FAILURE, 'errormsg' => $err ?: 'DB接続に失敗しました');
        }
        return array('code' => RESULT_SUCCESS, 'output' => $rows);
    }

    // $data = { accounts: [...], diag: [...] }
    //  accounts: 通常アカウント。{updatemark: INSERT|UPDATE|NONE, id?, ...列の値, authority?}
    //            NONE は通常アカウント自体は更新せず権限だけ同期する。
    //            authority キーがあれば（null＝権限なし）そのアカウントの権限を同期する
    //  diag    : DIAG用アカウント。{id, delfg}（論理削除・復活のみ。新規追加はしない）
    public function apply($userid = null, $key = null, $target = 0, $data = null)
    {
        $auth = new AuthSession();
        if (!$auth->checkLogin($userid, $key)) {
            return array('code' => RESULT_FAILURE, 'errorcode' => ERROR_LOGIN_STATE_MISSMATCH, 'errormsg' => "don't login");
        }
        $db = $auth->connectionDb($target);
        $now = date('Y-m-d H:i:s');
        $done = array('accounts' => 0, 'diag' => 0);

        $fail = function ($msg) use ($db, &$done) {
            $db->close();
            return array('code' => RESULT_FAILURE, 'errorcode' => 0, 'errormsg' => $msg, 'output' => $done);
        };

        $accounts = (is_object($data) && isset($data->accounts) && is_array($data->accounts)) ? $data->accounts : array();
        $diags = (is_object($data) && isset($data->diag) && is_array($data->diag)) ? $data->diag : array();

        // 権限マスタのid。権限を同期する行がある時だけ引く（無い場合は権限マスタを要求しない）
        $authorityIds = null;
        foreach ($accounts as $info) {
            if (property_exists($info, 'authority')) {
                $authorityIds = $this->loadAuthorityIds($db);
                if ($authorityIds === null) return $fail('権限マスタ(t_authority_manage)にALL_MANUAL/HTML_BROWSINGが見つかりません');
                break;
            }
        }

        foreach ($accounts as $i => $info) {
            $accountId = null;
            if (isset($info->updatemark) && $info->updatemark === 'NONE') {
                $accountId = $info->id;
            } else {
                $written = TInetUserAuthWriter::write($db, $this->normalTable, $info, $now);
                if (!$written['skipped']) {
                    if (!$written['ok']) return $fail('通常アカウントの書き込みに失敗しました（' . ($i + 1) . '件目）: ' . $db->errMsg);
                    $accountId = $written['id'];
                }
            }
            if ($accountId !== null && property_exists($info, 'authority')) {
                $err = $this->syncAuthority($db, $accountId, $info->authority, $authorityIds, $now);
                if ($err !== null) return $fail('権限の書き込みに失敗しました（' . ($i + 1) . '件目）: ' . $err);
            }
            $done['accounts']++;
        }

        foreach ($diags as $i => $info) {
            // DIAG用は論理削除・復活だけ（delfg以外の列は触らない）
            $upd = (object) array('updatemark' => 'UPDATE', 'id' => $info->id, 'delfg' => !empty($info->delfg));
            $written = TInetUserAuthWriter::write($db, $this->diagTable, $upd, $now);
            if (!$written['ok']) return $fail('DIAG用アカウントの書き込みに失敗しました（' . ($i + 1) . '件目）: ' . $db->errMsg);
            $done['diag']++;
        }

        $db->close();
        return array('code' => RESULT_SUCCESS, 'errorcode' => 0, 'errormsg' => '', 'output' => $done);
    }

    // authority_type => id。2種類とも見つからなければnull
    private function loadAuthorityIds($db)
    {
        $rows = $db->query("select id, authority_type from t_authority_manage where authority_type in ('ALL_MANUAL', 'HTML_BROWSING')");
        if (!is_array($rows)) return null;
        $ids = array();
        foreach ($rows as $row) $ids[$row['authority_type']] = (int) $row['id'];
        foreach ($this->managedAuthorities as $type) {
            if (!isset($ids[$type])) return null;
        }
        return $ids;
    }

    // 管理対象の2種類を、desired（'ALL_MANUAL'|'HTML_BROWSING'|null）に揃える。
    // 戻り値：成功ならnull、失敗ならエラーメッセージ
    private function syncAuthority($db, $accountId, $desired, $authorityIds, $now)
    {
        foreach ($this->managedAuthorities as $type) {
            $authorityId = $authorityIds[$type];
            $existing = $db->query(
                "select id, applicate from t_user_authority_manage where authority_id = ? and account_type = ? and account_id = ?",
                array($authorityId, $this->accountType, $accountId)
            );
            if (!is_array($existing)) return $db->errMsg ?: 'DBの読み取りに失敗しました';
            $row = count($existing) > 0 ? $existing[0] : null;

            if ($type === $desired) {
                if ($row === null) {
                    $ret = $db->execute(
                        "insert into t_user_authority_manage (authority_id, account_type, account_id, applicate, registed_date, updated_date) values (?, ?, ?, 1, ?, ?)",
                        array($authorityId, $this->accountType, $accountId, $now, $now)
                    );
                } elseif ((int) $row['applicate'] !== 1) {
                    $ret = $db->execute("update t_user_authority_manage set applicate = 1, updated_date = ? where id = ?", array($now, $row['id']));
                } else {
                    $ret = true;
                }
            } else {
                if ($row !== null && (int) $row['applicate'] === 1) {
                    $ret = $db->execute("update t_user_authority_manage set applicate = 0, updated_date = ? where id = ?", array($now, $row['id']));
                } else {
                    $ret = true;
                }
            }
            if (!$ret) return $db->errMsg;
        }
        return null;
    }
}
