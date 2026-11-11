<?php
require_once __DIR__ . '/AuthSession.php';
require_once __DIR__ . '/../../lib/TInetUserAuthWriter.php';
require_once __DIR__ . '/../../lib/AuthorityManageWriter.php';

// アカウント認証のExcel取り込み適用**専用**。通常アカウント・DIAG用アカウント・権限
// （t_user_authority_manage）をまたいで、1回の呼び出しで複数件まとめて書き込む
// 「複数テーブルに波及するバッチ操作」なので、引数でテーブルを選ばず、専用のサービス・
// メソッド名で表現する（2026-10-09方針）。
//
// 【Excel取り込み専用である理由】個別の手動編集・手動追加（1件だけ、権限込みのことも
// ある）は、ここではなく DbManagerTInetUserAuth.update の authority 付き呼び出しを使う
// （2026-11-12）。件数・エラー処理の考え方（本サービスは「ベストエフォート、途中失敗は
// 次回の再取り込みで補う」前提。手動編集はその場で正確な成否を返したい）が違うため、
// あえてサービスを分けている。詳細はdocs/アカウント認証_権限とDIAG用アカウント.md参照
//
// 【原子性の限界】t_user_authority_manage は MyISAM（トランザクション非対応）。
// 途中で失敗しても巻き戻せない。Express側は毎回DBを読み直して差分を再計算するため、
// 失敗後に同じファイルをもう一度取り込めば残りが自然に補われる（冪等）。
// ここでは最初の失敗で即座に打ち切り、何件目で失敗したかをerrormsgに入れて返す。
//
// 権限（ALL_MANUAL/HTML_BROWSING）の実際の同期ロジックは AuthorityManageWriter
// （lib/AuthorityManageWriter.php）に切り出し済み。DbManagerTInetUserAuth.update・
// DbManagerAuthorityManage とも同じ部品を使う（2026-11-12切り出し）

if (!defined('RESULT_SUCCESS')) define('RESULT_SUCCESS', 0);
if (!defined('RESULT_FAILURE')) define('RESULT_FAILURE', -1);
if (!defined('ERROR_LOGIN_STATE_MISSMATCH')) define('ERROR_LOGIN_STATE_MISSMATCH', 7);

class DbManagerAccountAuthImport
{
    private $normalTable = 't_inet_user_auth';
    private $diagTable = 't_inet_user_auth_ds3';

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
                $authorityIds = AuthorityManageWriter::loadAuthorityIds($db);
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
                $err = AuthorityManageWriter::sync($db, $accountId, $info->authority, $authorityIds, $now);
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
}
