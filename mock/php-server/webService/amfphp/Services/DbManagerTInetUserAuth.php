<?php
require_once __DIR__ . '/AuthSession.php';

// docs/legacy-amfphp/webService/DbManagerTInetUserAuth.php のJSON契約
// （load/updateの引数・戻り値の形）と、DBアクセスの仕方（DBConnectionクラス経由で
// query()/execute()にSQL＋プレースホルダの値を渡す）をSQLiteで再現する開発用モック。
//
// 本物との違い（意図的な簡略化）：
// - AuthSession（同ディレクトリのAuthSession.php参照）は本物と同じインターフェースだが、
//   checkLoginは実際にDBと照合せず、connectionDbはプライマリ/レプリカを繋ぎ分けない
// - LPAD等のフォーマットや電子マニュアル権限の連動削除など、本物固有の
//   業務ロジックまでは再現しない
// これはExpress側（amfphpClient.ts・リポジトリ）の実装・型・エラーハンドリングを
// このMac単体で確認するためのスタブであり、業務ロジックの正しさの保証はしない
//
// 【重要な制約】本物と同じく、この update() は「行の一部の列だけ書き換える」
// ことができない。INSERT/UPDATEどちらも常に全カラムを送る前提のSQLになっている
// （UPDATE文のSET句が固定で、可変にする仕組みが無い）。呼び出し側（Express）が
// 「delfgだけ変えたい」場合でも、他の全カラムの現在値を読み直して一緒に送り直す
// 必要がある（詳細はdocs/AMFPHP連携.md §5）

// 【define() とは】PHPで定数を作る組み込み関数。define('名前', 値)と書くと、
// classやfunctionの外で定義してもプログラム全体どこからでもその名前で値を
// 参照できるようになる（JSのconstに近いが、スコープがより広い）
define('RESULT_SUCCESS', 0);   // $resultValue["code"]がこの値なら成功
define('RESULT_FAILURE', -1);  // 失敗
define('ERROR_LOGIN_STATE_MISSMATCH', 7); // ログイン確認に失敗した時のerrorcode

class DbManagerTInetUserAuth
{
    // targetTableIdの0/1が、それぞれどのテーブルに対応するかの対応表。
    // 本物のDbManagerTInetUserAuth.phpと同じ並び（0=t_inet_user_auth）
    private $targetTables = array('t_inet_user_auth', 't_inet_user_auth_ds3');

    // 位置3(targetTableId)から、実際に操作するテーブル名を決める。
    // 範囲外の値が来たら null を返し、呼び出し元でエラー扱いにする
    private function resolveTable($arg)
    {
        $targetTableId = isset($arg[0][3]) ? $arg[0][3] : null;
        if ($targetTableId === null || $targetTableId < 0 || $targetTableId >= count($this->targetTables)) {
            return null;
        }
        return $this->targetTables[$targetTableId];
    }

    // 一覧取得。$arg[0] = [userid, key, target, targetTableId]（データ部分は無い）
    public function load($arg)
    {
        // 本物と同じく、位置0/1がuserid/key、AuthSession経由でログイン確認する
        $userid = isset($arg[0][0]) ? $arg[0][0] : null;
        $key = isset($arg[0][1]) ? $arg[0][1] : null;
        $auth = new AuthSession();
        $login = $auth->checkLogin($userid, $key);
        if (!$login) {
            // ログイン確認NG。$resultValueに相当する連想配列をそのまま返す
            // （gateway.phpがこれをjson_encodeしてHTTPレスポンスにする）
            return array('code' => RESULT_FAILURE, 'errorcode' => ERROR_LOGIN_STATE_MISSMATCH, 'errormsg' => "don't login");
        }
        $table = $this->resolveTable($arg);
        if ($table === null) {
            return array('code' => RESULT_FAILURE, 'errormsg' => 'argument is invalid.');
        }

        // 位置2(target)をAuthSession::connectionDb()に渡し、接続済みDBConnectionを得る
        $target = isset($arg[0][2]) ? $arg[0][2] : 0;
        $db = $auth->connectionDb($target);
        // 本物と同じく、DBConnection::query()にSQLを渡すだけ（値の埋め込みが無いので
        // $valuesは省略）。PDO::FETCH_ASSOC相当（カラム名をキーにした連想配列の配列）で返る
        $rows = $db->query("select * from $table order by id");
        $db->close();

        if ($rows === false) {
            return array('code' => RESULT_FAILURE, 'errormsg' => $db->errMsg);
        }
        return array('code' => RESULT_SUCCESS, 'output' => $rows);
    }

    // 追加/更新/削除。$arg[0] = [userid, key, target, targetTableId, data]。
    // dataは1件ずつ {updatemark: "INSERT"|"UPDATE"|"DELETE", ...列の値} という
    // 連想配列の配列で、1回の呼び出しで複数件（追加・更新・削除が混在）を処理できる
    public function update($arg)
    {
        $userid = isset($arg[0][0]) ? $arg[0][0] : null;
        $key = isset($arg[0][1]) ? $arg[0][1] : null;
        $auth = new AuthSession();
        $login = $auth->checkLogin($userid, $key);
        if (!$login) {
            return array('code' => RESULT_FAILURE, 'errorcode' => ERROR_LOGIN_STATE_MISSMATCH, 'errormsg' => "don't login");
        }
        $table = $this->resolveTable($arg);
        if ($table === null) {
            return array('code' => RESULT_FAILURE, 'errormsg' => 'argument4 is invalid.');
        }
        $data = isset($arg[0][4]) ? $arg[0][4] : null; // 位置4 = 処理対象レコードの配列

        $target = isset($arg[0][2]) ? $arg[0][2] : 0;
        $db = $auth->connectionDb($target);
        $result = RESULT_SUCCESS;
        $errorcode = 0;
        $errormsg = '';

        if (is_array($data)) {
            $now = date('Y-m-d H:i:s'); // このバッチ内の全レコードで同じ日時にする
            foreach ($data as $info) {
                $updatemark = isset($info['updatemark']) ? $info['updatemark'] : null;

                if ($updatemark === 'INSERT') {
                    // 本物と同じく、SQL文字列＋プレースホルダの値を$db->execute()に渡す形。
                    // DBConnection側がprepare/bindValue/executeの面倒を見てくれる
                    $ret = $db->execute(
                        "insert into $table
                            (username, password, comment, number, submission_date, regist_date,
                             company_cd, company_name, store_cd, store_name,
                             company_store_cd, company_store_branch_num, non_sync, delfg, reg_date, upd_date)
                            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        array(
                            $info['username'], $info['password'],
                            isset($info['comment']) ? $info['comment'] : null,
                            isset($info['number']) ? $info['number'] : null,
                            isset($info['submission_date']) ? $info['submission_date'] : null,
                            isset($info['regist_date']) ? $info['regist_date'] : null,
                            isset($info['company_cd']) ? $info['company_cd'] : null,
                            isset($info['company_name']) ? $info['company_name'] : null,
                            isset($info['store_cd']) ? $info['store_cd'] : null,
                            isset($info['store_name']) ? $info['store_name'] : null,
                            isset($info['company_store_cd']) ? $info['company_store_cd'] : null,
                            isset($info['company_store_branch_num']) ? $info['company_store_branch_num'] : null,
                            !empty($info['non_sync']) ? 1 : 0,
                            !empty($info['delfg']) ? 1 : 0,
                            $now, $now, // reg_date, upd_date とも新規作成時刻
                        )
                    );
                } elseif ($updatemark === 'UPDATE') {
                    // 【部分更新ができない点に注意】SET句が全カラム固定で書かれており、
                    // 「delfgだけ変えたい」といった一部カラムだけの更新はできない。
                    // 呼び出し側は毎回、変えたくない列も含めて全部の値を渡す必要がある
                    // （Express側 accountAuth.ts の toInput/currentById はこれへの対処）
                    $ret = $db->execute(
                        "update $table set
                            username=?, password=?, comment=?, number=?, submission_date=?, regist_date=?,
                            company_cd=?, company_name=?, store_cd=?, store_name=?,
                            company_store_cd=?, company_store_branch_num=?, non_sync=?, delfg=?, upd_date=?
                            where id=?",
                        array(
                            $info['username'], $info['password'],
                            isset($info['comment']) ? $info['comment'] : null,
                            isset($info['number']) ? $info['number'] : null,
                            isset($info['submission_date']) ? $info['submission_date'] : null,
                            isset($info['regist_date']) ? $info['regist_date'] : null,
                            isset($info['company_cd']) ? $info['company_cd'] : null,
                            isset($info['company_name']) ? $info['company_name'] : null,
                            isset($info['store_cd']) ? $info['store_cd'] : null,
                            isset($info['store_name']) ? $info['store_name'] : null,
                            isset($info['company_store_cd']) ? $info['company_store_cd'] : null,
                            isset($info['company_store_branch_num']) ? $info['company_store_branch_num'] : null,
                            !empty($info['non_sync']) ? 1 : 0,
                            !empty($info['delfg']) ? 1 : 0,
                            $now, // upd_dateだけ更新。reg_date（作成日時）はUPDATEでは変えない
                            $info['id'], // where id=? に対応する最後の値
                        )
                    );
                } elseif ($updatemark === 'DELETE') {
                    // 物理削除。本物同様、論理削除(delfg=1)にしたい場合は
                    // updatemark: 'DELETE' ではなく 'UPDATE' + delfg:true を送る
                    $ret = $db->execute("delete from $table where id=?", array($info['id']));
                } else {
                    // updatemarkが上記3つのいずれでもない場合は何もせず次のレコードへ進む
                    // （本物と同じく、想定外の値に対する明示的なエラー処理は無い）
                    continue;
                }

                if (!$ret) {
                    // DBConnection::execute()は失敗時に$this->statusと同じ値(false)を返す。
                    // 1件でも失敗したら即座にループを抜けて失敗扱いにする（本物のupdate()と
                    // 同じく、途中まで成功した分がロールバックされる保証は無い＝疑似的な原子性）
                    $result = RESULT_FAILURE;
                    $errormsg = $db->errMsg;
                    break;
                }
            }
        }

        $db->close();
        return array('code' => $result, 'errorcode' => $errorcode, 'errormsg' => $errormsg);
    }
}
