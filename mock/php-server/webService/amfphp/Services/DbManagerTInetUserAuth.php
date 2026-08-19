<?php
// docs/legacy-amfphp/webService/DbManagerTInetUserAuth.php のJSON契約
// （load/updateの引数・戻り値の形）だけをSQLiteで再現する開発用モック。
//
// 本物との違い（意図的な簡略化）：
// - AuthSession::checkLogin/connectionDb は使わず、userid/keyが空でないことだけ見る
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

    // SQLiteへの接続を1つ作って返す。初回だけテーブルも作る（本物はMySQLで
    // テーブルは既に存在する前提だが、モックはまっさらな状態から動くようにする）
    private function db()
    {
        // 【__DIR__ とは】このファイル自身が置かれているディレクトリの絶対パスに
        // 自動的に置き換わるマジック定数。ここから3つ上（Services→amfphp→
        // webService）に上がった先の data/ フォルダにSQLiteファイルを置く
        $dbPath = __DIR__ . '/../../../data/amfphp_mock.sqlite';
        $isNew = !file_exists($dbPath); // ファイルがまだ無い＝初回起動
        $pdo = new PDO('sqlite:' . $dbPath);
        // PDOのデフォルトは「SQLが失敗しても黙ってfalseを返すだけ」。
        // ERRMODE_EXCEPTIONにすると、失敗時に例外(throw)されるようになり、
        // 下のtry/catchで一括して拾えるようになる
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        if ($isNew) {
            // 対象2テーブルとも同じ列構成で作る（本物のCREATE TABLE文は未入手のため、
            // load/updateが読み書きする列だけを集めた簡易スキーマ）
            foreach ($this->targetTables as $table) {
                $pdo->exec("CREATE TABLE $table (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT, password TEXT, comment TEXT, number INTEGER,
                    submission_date TEXT, regist_date TEXT,
                    company_cd TEXT, company_name TEXT,
                    store_cd TEXT, store_name TEXT,
                    company_store_cd TEXT, company_store_branch_num TEXT,
                    non_sync INTEGER DEFAULT 0, delfg INTEGER DEFAULT 0,
                    reg_date TEXT, upd_date TEXT
                )");
            }
        }
        return $pdo;
    }

    // 本物は AuthSession::checkLogin($userid, $key) だが、ここでは簡易チェックのみ。
    // $arg は gateway.php 経由で渡ってくる parameters の1階層目、つまり
    // [userid, key, target, targetTableId, ...] という位置引数の配列（$arg[0]）
    private function checkLogin($arg)
    {
        $userid = isset($arg[0][0]) ? $arg[0][0] : null; // 位置0 = userid
        $key = isset($arg[0][1]) ? $arg[0][1] : null;     // 位置1 = key
        // 本物はDBの t_mng_admin テーブルと突き合わせて認証するが、
        // モックでは「両方とも空でなければOK」というだけの簡易判定にしている
        return !empty($userid) && !empty($key);
    }

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
        if (!$this->checkLogin($arg)) {
            // ログイン確認NG。$resultValueに相当する連想配列をそのまま返す
            // （gateway.phpがこれをjson_encodeしてHTTPレスポンスにする）
            return array('code' => RESULT_FAILURE, 'errorcode' => ERROR_LOGIN_STATE_MISSMATCH, 'errormsg' => "don't login");
        }
        $table = $this->resolveTable($arg);
        if ($table === null) {
            return array('code' => RESULT_FAILURE, 'errormsg' => 'argument is invalid.');
        }
        try {
            $db = $this->db();
            // PDO::FETCH_ASSOC＝各行を「カラム名をキーにした連想配列」として受け取る指定。
            // fetchAll()なので全行まとめて配列で返る
            $rows = $db->query("SELECT * FROM $table ORDER BY id")->fetchAll(PDO::FETCH_ASSOC);
            return array('code' => RESULT_SUCCESS, 'output' => $rows);
        } catch (Exception $e) {
            return array('code' => RESULT_FAILURE, 'errorcode' => $e->getCode(), 'errormsg' => $e->getMessage());
        }
    }

    // 追加/更新/削除。$arg[0] = [userid, key, target, targetTableId, data]。
    // dataは1件ずつ {updatemark: "INSERT"|"UPDATE"|"DELETE", ...列の値} という
    // 連想配列の配列で、1回の呼び出しで複数件（追加・更新・削除が混在）を処理できる
    public function update($arg)
    {
        if (!$this->checkLogin($arg)) {
            return array('code' => RESULT_FAILURE, 'errorcode' => ERROR_LOGIN_STATE_MISSMATCH, 'errormsg' => "don't login");
        }
        $table = $this->resolveTable($arg);
        if ($table === null) {
            return array('code' => RESULT_FAILURE, 'errormsg' => 'argument4 is invalid.');
        }
        $data = isset($arg[0][4]) ? $arg[0][4] : null; // 位置4 = 処理対象レコードの配列

        $result = RESULT_SUCCESS;
        $errorcode = 0;
        $errormsg = '';

        if (is_array($data)) {
            try {
                $db = $this->db();
                $now = date('Y-m-d H:i:s'); // このバッチ内の全レコードで同じ日時にする
                foreach ($data as $info) {
                    $updatemark = isset($info['updatemark']) ? $info['updatemark'] : null;
                    if ($updatemark === 'INSERT') {
                        // 【プリペアドステートメントとは】SQL文の値の部分を "?" にしておき、
                        // 実際の値は execute() に配列で渡して後から安全に埋め込む書き方。
                        // 文字列を直接連結しないのでSQLインジェクションを防げる
                        $stmt = $db->prepare("INSERT INTO $table
                            (username, password, comment, number, submission_date, regist_date,
                             company_cd, company_name, store_cd, store_name,
                             company_store_cd, company_store_branch_num, non_sync, delfg, reg_date, upd_date)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                        $stmt->execute(array(
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
                            // non_sync/delfgはExpress側からtrue/falseで来るが、SQLiteの列は
                            // INTEGERなので0/1に変換してから渡す
                            !empty($info['non_sync']) ? 1 : 0,
                            !empty($info['delfg']) ? 1 : 0,
                            $now, $now, // reg_date, upd_date とも新規作成時刻
                        ));
                    } elseif ($updatemark === 'UPDATE') {
                        // 【部分更新ができない点に注意】SET句が全カラム固定で書かれており、
                        // 「delfgだけ変えたい」といった一部カラムだけの更新はできない。
                        // 呼び出し側は毎回、変えたくない列も含めて全部の値を渡す必要がある
                        // （Express側 accountAuth.ts の toInput/currentById はこれへの対処）
                        $stmt = $db->prepare("UPDATE $table SET
                            username=?, password=?, comment=?, number=?, submission_date=?, regist_date=?,
                            company_cd=?, company_name=?, store_cd=?, store_name=?,
                            company_store_cd=?, company_store_branch_num=?, non_sync=?, delfg=?, upd_date=?
                            WHERE id=?");
                        $stmt->execute(array(
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
                            $info['id'], // WHERE id=? に対応する最後の値
                        ));
                    } elseif ($updatemark === 'DELETE') {
                        // 物理削除。本物同様、論理削除(delfg=1)にしたい場合は
                        // updatemark: 'DELETE' ではなく 'UPDATE' + delfg:true を送る
                        $db->prepare("DELETE FROM $table WHERE id=?")->execute(array($info['id']));
                    }
                    // updatemarkが上記3つのいずれでもない場合は何もせず次のレコードへ進む
                    // （本物と同じく、想定外の値に対する明示的なエラー処理は無い）
                }
            } catch (Exception $e) {
                // 1件でも失敗したら即座にループを抜けて失敗扱いにする（本物のupdate()と
                // 同じく、途中まで成功した分がロールバックされる保証は無い＝疑似的な原子性）
                $result = RESULT_FAILURE;
                $errorcode = $e->getCode();
                $errormsg = $e->getMessage();
            }
        }

        return array('code' => $result, 'errorcode' => $errorcode, 'errormsg' => $errormsg);
    }
}
