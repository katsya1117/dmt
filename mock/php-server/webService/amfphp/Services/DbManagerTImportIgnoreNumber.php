<?php
require_once __DIR__ . '/AuthSession.php';
define('RESULT_SUCCESS', 0);
define('RESULT_FAILURE', -1);
define('ERROR_LOGIN_STATE_MISSMATCH', 7);

// Excel取り込みの差分無視Noリスト用モック。DbManagerTInetUserAuth.phpと同じ
// JSON契約（load/update）・DBアクセス方式をSQLiteで再現する開発用スタブ。
// 客先の実テーブルは未確定（仮スキーマ）。詳細はdocs/AMFPHP連携_差分無視リスト.md参照。
//
// 【重要な制約】DbManagerTInetUserAuth.phpと同じく、update()は行の一部の列だけ
// 書き換えることができない（UPDATE文のSET句が固定）。「無視リストから外す」操作も
// 物理DELETEではなく、全カラムを送り直した上でignfgを1にするUPDATEとして扱う
// （客先側のDB更新の仕組みが物理削除と相性が悪いことに由来する制約。account_auth
// のdelfgと同じ考え方）

class DbManagerTImportIgnoreNumber
{
    // 本物同様、targetTableIdからテーブル名を決める仕組みを踏襲（現状は1種類のみ）
    private $targetTables = array('t_import_ignore_number');

    private function resolveTable($arg)
    {
        $targetTableId = isset($arg[0][3]) ? $arg[0][3] : null;
        if ($targetTableId === null || $targetTableId < 0 || $targetTableId >= count($this->targetTables)) {
            return null;
        }
        return $this->targetTables[$targetTableId];
    }

    // 一覧取得。$arg[0] = [userid, key, target, targetTableId]
    public function load($arg)
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
            return array('code' => RESULT_FAILURE, 'errormsg' => 'argument is invalid.');
        }

        $target = isset($arg[0][2]) ? $arg[0][2] : 0;
        $db = $auth->connectionDb($target);
        // ignfg問わず全件返す。ignfg=0への絞り込みはExpress側（importIgnoreList.ts）で行う
        $rows = $db->query("select * from $table order by id");
        $db->close();

        if ($rows === false) {
            return array('code' => RESULT_FAILURE, 'errormsg' => $db->errMsg);
        }
        return array('code' => RESULT_SUCCESS, 'output' => $rows);
    }

    // 追加/更新。$arg[0] = [userid, key, target, targetTableId, data]。
    // dataは1件ずつ {updatemark: "INSERT"|"UPDATE", ...列の値} という連想配列の配列
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
        $data = isset($arg[0][4]) ? $arg[0][4] : null;

        $target = isset($arg[0][2]) ? $arg[0][2] : 0;
        $db = $auth->connectionDb($target);
        $result = RESULT_SUCCESS;
        $errorcode = 0;
        $errormsg = '';

        if (is_array($data)) {
            $now = date('Y-m-d H:i:s');
            foreach ($data as $info) {
                $updatemark = isset($info['updatemark']) ? $info['updatemark'] : null;

                if ($updatemark === 'INSERT') {
                    $ret = $db->execute(
                        "insert into $table (number, ignfg, comment, reg_date, upd_date) values (?, ?, ?, ?, ?)",
                        array(
                            isset($info['number']) ? $info['number'] : null,
                            !empty($info['ignfg']) ? 1 : 0,
                            isset($info['comment']) ? $info['comment'] : null,
                            $now,
                            $now,
                        )
                    );
                } elseif ($updatemark === 'UPDATE') {
                    // 【部分更新ができない点に注意】無視リストから外す（ignfg=1にする）だけの
                    // 操作でも、呼び出し側は現在のnumber/commentを含め全カラムを送り直す必要がある
                    $ret = $db->execute(
                        "update $table set number=?, ignfg=?, comment=?, upd_date=? where id=?",
                        array(
                            isset($info['number']) ? $info['number'] : null,
                            !empty($info['ignfg']) ? 1 : 0,
                            isset($info['comment']) ? $info['comment'] : null,
                            $now,
                            $info['id'],
                        )
                    );
                } else {
                    // 物理DELETEは意図的にサポートしない（docs/AMFPHP連携_差分無視リスト.md参照）
                    continue;
                }

                if (!$ret) {
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
