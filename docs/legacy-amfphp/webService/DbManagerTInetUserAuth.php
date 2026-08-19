<?php
// [OCR要確認] require_once のパスは判読不能（他ファイルのパターンから推測して補完）
require_once '../config.php';
require_once 'AuthSession.php';

define('RESULT_SUCCESS', 0);
define('RESULT_FAILURE', -1);
define('ERROR_LOGIN_STATE_MISSMATCH', 7);

class DbManagerTInetUserAuth
{
    private $targetTables = array("t_inet_user_auth", "t_inet_user_auth_ds3");
    //<---

    /**
     * BASIC認証情報をすべて取得します
     */
    public function load($arg)
    {
        $userid = $arg[0][0];
        $key = $arg[0][1];
        $auth = new AuthSession();
        $login = $auth->checkLogin($userid, $key);
        if (false == $login) {
            $resultValue["code"] = RESULT_FAILURE;
            $resultValue["errorcode"] = ERROR_LOGIN_STATE_MISSMATCH;
            $resultValue["errormsg"] = "don't login";
            return $resultValue;
        }
        $target = $arg[0][2];
        $targetTableId = $arg[0][3];
        if ($targetTableId < 0 || $targetTableId >= count($this->targetTables)) {
            $resultValue["code"] = RESULT_FAILURE;
            $resultValue["errormsg"] = "argument is invalid." . $targetTableId . " " . count($this->targetTables);
            return $resultValue;
        }
        //<---

        $db = NULL;
        try {
            //$db = new DBConnection();
            //$db->connect(DB_HOST, DB_USER, DB_PASS, DB_NAME);
            $db = $auth->connectionDb($target);
            $result = NULL;
            // 2016/03/18 コード型不備のため、カラムを指定して取得する
            //$result = $db->query("select * from " . $this->targetTables[$targetTableId] . " order by id");
            $result = $db->query(
                "select " .
                    "id, username, password, comment, number, submission_date, regist_date," .
                    "lpad(company_cd, 3, '0') company_cd, company_name," .
                    "lpad(store_cd, 5, '0') store_cd, store_name, " .
                    "reg_date, upd_date " .
                    // 2017/05/15  削除フラグを追加
                    ", delfg " .
                    // 2018/07/25  店舗CDと枝番、同期対象外を追加
                    ", lpad(company_store_cd, 2, '0') company_store_cd, company_store_branch_num, non_sync " .
                    "from " . $this->targetTables[$targetTableId] . " order by id"
            );
            $db->close();
        } catch (Exception $e) {
            if (!is_null($db)) $db->close();
            $resultValue["code"] = RESULT_FAILURE;
            $resultValue["errorcode"] = $e->getCode();
            $resultValue["errormsg"] = $e->getMessage();
            return $resultValue;
        }
        $resultValue["code"] = RESULT_SUCCESS;
        $resultValue["output"] = $result;
        return $resultValue;
    }

    /**
     * 車種情報の登録/更新
     */
    public function update($arg)
    {
        Log::OUT("[tinetuserauth.update:start]");
        $errorcode = 0;
        $errormsg = "";
        $result = RESULT_SUCCESS;
        $userid = $arg[0][0];
        $key = $arg[0][1];
        $auth = new AuthSession();
        $login = $auth->checkLogin($userid, $key);
        if (false == $login) {
            $resultValue["code"] = RESULT_FAILURE;
            $resultValue["errorcode"] = ERROR_LOGIN_STATE_MISSMATCH;
            $resultValue["errormsg"] = "don't login";
            return $resultValue;
        }
        $target = $arg[0][2];
        $targetTableId = $arg[0][3];
        if ($targetTableId < 0 || $targetTableId >= count($this->targetTables)) {
            $resultValue["code"] = RESULT_FAILURE;
            $resultValue["errormsg"] = "argument4 is invalid.";
            return $resultValue;
        }
        //<---

        //$db = new DBConnection();
        //$db->connect(DB_HOST, DB_USER, DB_PASS, DB_NAME);
        $db = $auth->connectionDb($target);
        $data = $arg[0][4];
        if (is_array($data)) {
            foreach ($data as $info) {
                Log::OUT("updatemark:" . $info["updatemark"] . ",id:" . $info["id"] . "," . "username:" . $info["username"]);

                ob_start();
                var_dump($info);
                $out = ob_get_contents();
                ob_end_clean();
                Log::OUT($out);

                if ($info["updatemark"] == "INSERT") {
                    $ret = $db->execute(
                        "insert into " . $this->targetTables[$targetTableId] . " (" .
                            // 2016/03/29  販社情報等個別登録
                            // "username, password, comment, reg_date) values (".
                            // "?,?,?,NOW()) ",
                            // array($info["username"], $info["password"],$info["comment"]));
                            "username, password, comment, reg_date," .
                            "number, submission_date, regist_date," .
                            "company_cd, company_name, store_cd, store_name, " .
                            // 2018/07/25 店舗CD、枝番、同期対象外
                            "company_store_cd, company_store_branch_num, non_sync) values (" .
                            "?, ?, ?, NOW()," .
                            "?, ?, ?, ?, ?, ?, ?, lpad(?,2,'0'), ?, ?" .
                            ")",
                        array(
                            $info["username"],
                            $info["password"],
                            $info["comment"],
                            (array_key_exists("number", $info)) ? $info["number"] : null,
                            (array_key_exists("submission_date", $info) && !empty($info["submission_date"])) ? $info["submission_date"] : null,
                            (array_key_exists("regist_date", $info) && !empty($info["regist_date"])) ? $info["regist_date"] : null,
                            (array_key_exists("company_cd", $info) && !empty($info["company_cd"])) ? $info["company_cd"] : null,
                            (array_key_exists("company_name", $info)) ? $info["company_name"] : null,
                            (array_key_exists("store_cd", $info) && !empty($info["store_cd"])) ? $info["store_cd"] : null,
                            (array_key_exists("store_name", $info)) ? $info["store_name"] : null,
                            // 2018/07/25 店舗CD、枝番、同期対象外
                            (array_key_exists("company_store_cd", $info) && !empty($info["company_store_cd"])) ? $info["company_store_cd"] : null,
                            (array_key_exists("company_store_branch_num", $info) && !empty($info["company_store_branch_num"])) ? $info["company_store_branch_num"] : null,
                            (array_key_exists("non_sync", $info) && !empty($info["non_sync"])) ? $info["non_sync"] : 0
                        )
                    );
                } else if ($info["updatemark"] == "UPDATE") {
                    $ret = $db->execute(
                        "update " . $this->targetTables[$targetTableId] . " set " .
                            // 2016/03/29 販社情報等個別登録
                            // "username=?, password=?, comment=? where id = ?",
                            //
                            // array($info["username"],$info["password"],$info["comment"],$info["id"]));
                            "username=?, password=?, comment=?, " .
                            "number=?, submission_date=?, regist_date=?," .
                            "company_cd=?, company_name=?, store_cd=?, store_name=? " .
                            // 2017/05/15 削除状態追加
                            ", delfg = ? " .
                            // 2018/07/25 店舗CD、枝番、同期対象外
                            ", company_store_cd = lpad(?, 2, '0'), company_store_branch_num = ?, non_sync = ? " .
                            "WHERE id = ?",
                        array(
                            $info["username"],
                            $info["password"],
                            $info["comment"],
                            (array_key_exists("number", $info)) ? $info["number"] : null,
                            (array_key_exists("submission_date", $info) && !empty($info["submission_date"])) ? $info["submission_date"] : null,
                            (array_key_exists("regist_date", $info) && !empty($info["regist_date"])) ? $info["regist_date"] : null,
                            (array_key_exists("company_cd", $info) && !empty($info["company_cd"])) ? $info["company_cd"] : null,
                            (array_key_exists("company_name", $info)) ? $info["company_name"] : null,
                            (array_key_exists("store_cd", $info) && !empty($info["store_cd"])) ? $info["store_cd"] : null,
                            (array_key_exists("store_name", $info)) ? $info["store_name"] : null,
                            // 2017/05/15 削除状態追加
                            (array_key_exists("delfg", $info)) ? $info["delfg"] : false,
                            // 2018/07/25 店舗CD、枝番、同期対象外
                            (array_key_exists("company_store_cd", $info) && !empty($info["company_store_cd"])) ? $info["company_store_cd"] : null,
                            (array_key_exists("company_store_branch_num", $info) && !empty($info["company_store_branch_num"])) ? $info["company_store_branch_num"] : null,
                            (array_key_exists("non_sync", $info) && !empty($info["non_sync"])) ? $info["non_sync"] : 0,
                            $info["id"]
                        )
                    );
                } else if ($info["updatemark"] == "DELETE") {
                    $ret = $db->execute(
                        "delete from " . $this->targetTables[$targetTableId] . " where id = ?",
                        array($info["id"])
                    );
                    // 2017/11/02 電子マニュアルアカウントの場合、関連する権限情報も削除する。
                    if ($ret) {
                        if ($targetTableId == 0) { // 電子マニュアルアカウントか判定
                            $ret = $db->execute(
                                "delete from t_user_authority_manage where " .
                                    "account_id = ? and " .
                                    "account_type = 0 and " .
                                    "applicate = 1 and " .
                                    "authority_id in (select id from t_authority_manage " .
                                    "where applicate = 1 and" .
                                    " authority_type in ('ALL_MANUAL', 'HTML_BROWSING'))",
                                array($info["id"])
                            );
                        }
                    }
                }

                if ($ret) {
                    $result = RESULT_SUCCESS;
                } else {
                    Log::OUT("t_inet_user_auth update error!");
                    // [ORIGINAL] mysql_errno()/mysql_error() はPHP7で廃止された関数（DBConnection.phpと同じ問題）。
                    // PDOに移行済みの現行コードでは呼べないため、DBConnectionが保持しているエラー情報に置き換えた。
                    // errorcode（数値コード）に相当する値はDBConnection側に個別で残っていないため0のまま
                    // $errorcode = mysql_errno();
                    // $errormsg = mysql_error();
                    $errormsg = $db->errMsg;
                    $result = RESULT_FAILURE;
                    break;
                }
            }
        }
        $db->close();
        $resultValue["code"] = $result;
        $resultValue["errorcode"] = $errorcode;
        $resultValue["errormsg"] = $errormsg;
        Log::OUT("[tinetuserauth.update:complete]");

        return $resultValue;
    }
}
