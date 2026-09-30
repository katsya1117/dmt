<?php
require_once __DIR__ . '/AuthSession.php';
define('RESULT_SUCCESS', 0);
define('RESULT_FAILURE', -1);
define('ERROR_LOGIN_STATE_MISSMATCH', 7);

// 複数機能が相乗りする汎用キー・バリュー設定テーブル `_properties` 用モック。
// 客先に実在するテーブルだが、読み書き用のAMFPHPサービスクラスが既にあるかは
// 未確認（2026-10-01時点）。ある前提が崩れた場合に備え、無い前提で暫定実装する。
// 詳細・category_key/category_idの意味づけはdocs/AMFPHP連携_差分無視リスト.md参照。
//
// 【他のDbManagerXxxとの違い】_properties は複数機能の相乗りテーブルのため、
// load() は対象を絞り込む categoryKey を必須引数に取る（他カテゴリの行を
// 一切読み書きしない）。呼び出し側は必ず自分のcategory_keyを渡すこと

class DbManagerProperties
{
    // 一覧取得。$arg[0] = [userid, key, target, categoryKey]
    public function load($arg)
    {
        $userid = isset($arg[0][0]) ? $arg[0][0] : null;
        $key = isset($arg[0][1]) ? $arg[0][1] : null;
        $auth = new AuthSession();
        $login = $auth->checkLogin($userid, $key);
        if (!$login) {
            return array('code' => RESULT_FAILURE, 'errorcode' => ERROR_LOGIN_STATE_MISSMATCH, 'errormsg' => "don't login");
        }
        $categoryKey = isset($arg[0][3]) ? $arg[0][3] : null;
        if ($categoryKey === null || $categoryKey === '') {
            return array('code' => RESULT_FAILURE, 'errormsg' => 'categoryKey is required.');
        }

        $target = isset($arg[0][2]) ? $arg[0][2] : 0;
        $db = $auth->connectionDb($target);
        // del_fg=0の行のみ、自分のcategory_keyの範囲だけを返す（他機能の行は触らない）
        $rows = $db->query(
            "select * from _properties where category_key = ? and del_fg = 0 order by id",
            array($categoryKey)
        );
        $db->close();

        if ($rows === false) {
            return array('code' => RESULT_FAILURE, 'errormsg' => $db->errMsg);
        }
        return array('code' => RESULT_SUCCESS, 'output' => $rows);
    }

    // 追加/更新。$arg[0] = [userid, key, target, categoryKey, data]。
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
                $categoryKey = isset($info['category_key']) ? $info['category_key'] : null;

                if ($updatemark === 'INSERT') {
                    // category_idは業務的な意味を持たない連番。同時書き込みでの衝突を避けるため、
                    // 仮値(0)でINSERTした直後に、採番されたidをそのままcategory_idへ書き戻す
                    // （idはAUTO_INCREMENTでテーブル全体で一意なので、category_key内でも必ず一意になる）
                    $ret = $db->execute(
                        "insert into _properties
                            (category_key, category_id, value1_1, value1_2, update_date, valid_fg, del_fg)
                            values (?, 0, ?, ?, ?, 1, 0)",
                        array(
                            $categoryKey,
                            isset($info['value1_1']) ? $info['value1_1'] : null,
                            isset($info['value1_2']) ? $info['value1_2'] : null,
                            $now,
                        )
                    );
                    if ($ret) {
                        $newId = $db->lastInsertIdIntVal();
                        $ret = $db->execute("update _properties set category_id = ? where id = ?", array($newId, $newId));
                    }
                } elseif ($updatemark === 'UPDATE') {
                    // 【本当の部分更新】DbManagerTInetUserAuth.php等の旧FLEXアプリ向け
                    // レガシーコードと違い、これは新アプリ専用の新規実装で既存アプリと共有
                    // していないため、その「全カラム上書き固定」の作法を踏襲する制約は無い。
                    // $infoに含まれる列だけをSET句に組み込む（updatemark/id/category_keyは除く。
                    // category_keyは行の所属カテゴリなので更新対象にしない）
                    $updatableColumns = array('category_id', 'value1_1', 'value1_2', 'value1_3', 'value1_4', 'value1_5', 'valid_fg', 'del_fg');
                    $setParts = array('update_date = ?');
                    $values = array($now);
                    foreach ($updatableColumns as $col) {
                        if (array_key_exists($col, $info)) {
                            $setParts[] = "$col = ?";
                            $values[] = is_bool($info[$col]) ? ($info[$col] ? 1 : 0) : $info[$col];
                        }
                    }
                    $values[] = $info['id'];

                    $ret = $db->execute(
                        "update _properties set " . implode(', ', $setParts) . " where id = ?",
                        $values
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
