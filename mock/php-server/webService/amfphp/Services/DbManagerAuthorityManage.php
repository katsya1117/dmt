<?php
require_once __DIR__ . '/AuthSession.php';
require_once __DIR__ . '/../../lib/AuthorityManageWriter.php';

// t_user_authority_manage（権限）専用の正規サービス。
// 【現状、これを直接呼ぶ呼び出し元は無い】権限を書く操作は常に「通常アカウント本体の
// 書き込みと一緒」（DbManagerTInetUserAuth.update の authority 付き呼び出し、または
// DbManagerAccountAuthImport.apply）から行われ、どちらもAuthorityManageWriterを直接
// 呼ぶ（二重のログイン確認・DB接続を避けるため。TInetUserAuthWriterとDbManagerT
// InetUserAuth/Diagの関係と同じ）。それでも「権限を担当する正規サービス」自体は
// 他のテーブルと同じ粒度で存在させておく（一貫性のため。2026-11-12）。
if (!defined('RESULT_SUCCESS')) define('RESULT_SUCCESS', 0);
if (!defined('RESULT_FAILURE')) define('RESULT_FAILURE', -1);
if (!defined('ERROR_LOGIN_STATE_MISSMATCH')) define('ERROR_LOGIN_STATE_MISSMATCH', 7);

class DbManagerAuthorityManage
{
    // 全アカウントの権限一覧（applicate=0も含む。Express側が現在有効なものを判断する）
    public function load($userid = null, $key = null, $target = 0)
    {
        $auth = new AuthSession();
        if (!$auth->checkLogin($userid, $key)) {
            return array('code' => RESULT_FAILURE, 'errorcode' => ERROR_LOGIN_STATE_MISSMATCH, 'errormsg' => "don't login");
        }
        $db = $auth->connectionDb($target);
        $rows = AuthorityManageWriter::loadAll($db);
        $err = $db->errMsg;
        $db->close();
        if ($rows === false || $rows === null) {
            return array('code' => RESULT_FAILURE, 'errormsg' => $err ?: 'DB接続に失敗しました');
        }
        return array('code' => RESULT_SUCCESS, 'output' => $rows);
    }

    // 1アカウントの権限を desired（'ALL_MANUAL'|'HTML_BROWSING'|null）に揃える。
    // (userid, key, target, accountId, desired) を直接引数として受け取る
    public function update($userid = null, $key = null, $target = 0, $accountId = null, $desired = null)
    {
        $auth = new AuthSession();
        if (!$auth->checkLogin($userid, $key)) {
            return array('code' => RESULT_FAILURE, 'errorcode' => ERROR_LOGIN_STATE_MISSMATCH, 'errormsg' => "don't login");
        }
        $db = $auth->connectionDb($target);
        $now = date('Y-m-d H:i:s');

        $authorityIds = AuthorityManageWriter::loadAuthorityIds($db);
        if ($authorityIds === null) {
            $db->close();
            return array('code' => RESULT_FAILURE, 'errormsg' => '権限マスタ(t_authority_manage)にALL_MANUAL/HTML_BROWSINGが見つかりません');
        }

        $err = AuthorityManageWriter::sync($db, $accountId, $desired, $authorityIds, $now);
        $db->close();
        if ($err !== null) {
            return array('code' => RESULT_FAILURE, 'errormsg' => $err);
        }
        return array('code' => RESULT_SUCCESS, 'errorcode' => 0, 'errormsg' => '');
    }
}
