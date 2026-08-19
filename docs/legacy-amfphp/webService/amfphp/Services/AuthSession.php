<?php

require_once '../../config.php';
require_once 'ManagerAuth.php';

class AuthSession
{
    public function checkLogin($userid, $key)
    {
        $db = new DBConnection();
        $db->connect(DB_HOST, DB_USER, DB_PASS, DB_NAME);

        $auth = false;
        $result = NULL;
        $result = $db->query(
            "select count(id) as cnt from t_mng_admin where delfg = 0 " .
                "and id = ? and certificationkey = ?",
            array($userid, $key)
        );
        //$accountInfo = result[0];

        if ($result[0]["cnt"] == 1) {
            $auth = true;
        } else {
            $manageAuth = new ManagerAuth();
            $manageAuth->addUserAuthLogAtId(
                $db,
                $userid,
                REQUEST_CHECK,
                STATE_NOLOGIN,
                RESULT_FAILURE,
                ERROR_KEY_MISSMATCH,
                "doLogout: error key missmatch.",
                $key,
                ''
            );
        }
        $db->close();
        return $auth;
    }

    // $select: 0=プライマリDB / 0以外=レプリカ(R_DB_*)DB。詳細はconnectionDbForUserLog等も同様の分岐
    public function connectionDb($select)
    {
        $db = new DBConnection();
        if ($select == 0) {
            $db->connect(DB_HOST, DB_USER, DB_PASS, DB_NAME);
        } else {
            $db->connect(R_DB_HOST, R_DB_USER, R_DB_PASS, R_DB_NAME);
        }
        return $db;
    }

    public function connectionDbForUserLog($select)
    {
        $db = new DBConnection();
        if ($select == 0) {
            Log::OUT(LOG_DB_HOST . "," . LOG_DB_USER . "," . LOG_DB_PASS . "," . LOG_DB_NAME);
            $db->connect(LOG_DB_HOST, LOG_DB_USER, LOG_DB_PASS, LOG_DB_NAME);
        } else {
            Log::OUT(LOG_R_DB_HOST . "," . LOG_R_DB_USER . "," . LOG_R_DB_PASS . "," . LOG_R_DB_NAME);
            $db->connect(LOG_R_DB_HOST, LOG_R_DB_USER, LOG_R_DB_PASS, LOG_R_DB_NAME);
        }
        return $db;
    }

    public function connectionDbForHTMLUserLog($select)
    {
        $db = new DBConnection();
        if ($select == 0) {
            // [OCR要確認] 元は "Logs :: OUT(LOG_DB_HOST.",". LOG_DB_USER.",". LOG_DB_PASS." ". );"
            // で末尾が構文エラーだった。直上のconnectionDbForUserLog()と同じ並びで補完した
            Log::OUT(LOG_DB_HOST . "," . LOG_DB_USER . "," . LOG_DB_PASS . "," . HTML_LOG_DB_NAME);
            $db->connect(LOG_DB_HOST, LOG_DB_USER, LOG_DB_PASS, LOG_DB_NAME);
        } else {
            Log::OUT(LOG_R_DB_HOST . "," . LOG_R_DB_USER . "," . LOG_R_DB_PASS . "," . LOG_R_DB_NAME);
            $db->connect(LOG_R_DB_HOST, LOG_R_DB_USER, LOG_R_DB_PASS, HTML_LOG_R_DB_NAME);
        }
        return $db;
    }
}
