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

define('RESULT_SUCCESS', 0);
define('RESULT_FAILURE', -1);
define('ERROR_LOGIN_STATE_MISSMATCH', 7);

class DbManagerTInetUserAuth
{
    private $targetTables = array('t_inet_user_auth', 't_inet_user_auth_ds3');

    private function db()
    {
        $dbPath = __DIR__ . '/../../../data/amfphp_mock.sqlite';
        $isNew = !file_exists($dbPath);
        $pdo = new PDO('sqlite:' . $dbPath);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        if ($isNew) {
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

    // 本物は AuthSession::checkLogin($userid, $key) だが、ここでは簡易チェックのみ
    private function checkLogin($arg)
    {
        $userid = isset($arg[0][0]) ? $arg[0][0] : null;
        $key = isset($arg[0][1]) ? $arg[0][1] : null;
        return !empty($userid) && !empty($key);
    }

    private function resolveTable($arg)
    {
        $targetTableId = isset($arg[0][3]) ? $arg[0][3] : null;
        if ($targetTableId === null || $targetTableId < 0 || $targetTableId >= count($this->targetTables)) {
            return null;
        }
        return $this->targetTables[$targetTableId];
    }

    public function load($arg)
    {
        if (!$this->checkLogin($arg)) {
            return array('code' => RESULT_FAILURE, 'errorcode' => ERROR_LOGIN_STATE_MISSMATCH, 'errormsg' => "don't login");
        }
        $table = $this->resolveTable($arg);
        if ($table === null) {
            return array('code' => RESULT_FAILURE, 'errormsg' => 'argument is invalid.');
        }
        try {
            $db = $this->db();
            $rows = $db->query("SELECT * FROM $table ORDER BY id")->fetchAll(PDO::FETCH_ASSOC);
            return array('code' => RESULT_SUCCESS, 'output' => $rows);
        } catch (Exception $e) {
            return array('code' => RESULT_FAILURE, 'errorcode' => $e->getCode(), 'errormsg' => $e->getMessage());
        }
    }

    public function update($arg)
    {
        if (!$this->checkLogin($arg)) {
            return array('code' => RESULT_FAILURE, 'errorcode' => ERROR_LOGIN_STATE_MISSMATCH, 'errormsg' => "don't login");
        }
        $table = $this->resolveTable($arg);
        if ($table === null) {
            return array('code' => RESULT_FAILURE, 'errormsg' => 'argument4 is invalid.');
        }
        $data = isset($arg[0][4]) ? $arg[0][4] : null;

        $result = RESULT_SUCCESS;
        $errorcode = 0;
        $errormsg = '';

        if (is_array($data)) {
            try {
                $db = $this->db();
                $now = date('Y-m-d H:i:s');
                foreach ($data as $info) {
                    $updatemark = isset($info['updatemark']) ? $info['updatemark'] : null;
                    if ($updatemark === 'INSERT') {
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
                            !empty($info['non_sync']) ? 1 : 0,
                            !empty($info['delfg']) ? 1 : 0,
                            $now, $now,
                        ));
                    } elseif ($updatemark === 'UPDATE') {
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
                            $now, $info['id'],
                        ));
                    } elseif ($updatemark === 'DELETE') {
                        $db->prepare("DELETE FROM $table WHERE id=?")->execute(array($info['id']));
                    }
                }
            } catch (Exception $e) {
                $result = RESULT_FAILURE;
                $errorcode = $e->getCode();
                $errormsg = $e->getMessage();
            }
        }

        return array('code' => $result, 'errorcode' => $errorcode, 'errormsg' => $errormsg);
    }
}
