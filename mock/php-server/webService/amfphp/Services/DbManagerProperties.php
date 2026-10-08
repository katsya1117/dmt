<?php
require_once __DIR__ . '/AuthSession.php';
define('RESULT_SUCCESS', 0);
define('RESULT_FAILURE', -1);
define('ERROR_LOGIN_STATE_MISSMATCH', 7);

// 複数機能が相乗りする汎用キー・バリュー設定テーブル `_properties` 用モック。
// 客先に実在するテーブルだが、読み書き用のAMFPHPサービスクラスが既にあるかは
// 未確認（2026-10-01時点）。ある前提が崩れた場合に備え、無い前提で暫定実装する。
// 詳細・category_key/category_idの意味づけはdocs/AMFPHP連携_差分除外リスト.md参照。
//
// 【他のDbManagerXxxとの違い】_properties は複数機能の相乗りテーブルのため、
// load() は対象を絞り込む categoryKey を必須引数に取る（他カテゴリの行を
// 一切読み書きしない）。呼び出し側は必ず自分のcategory_keyを渡すこと

class DbManagerProperties
{
    // 一覧取得。$arg[0] = [userid, key, target, categoryKey]
    public function load($arg)
    {
        // $arg[0][N]という2次元アクセスを繰り返すと分かりづらいので、
        // 最初に$paramsへ展開してから、以降は1次元の$params[N]で読む
        $params = isset($arg[0]) ? $arg[0] : array();
        $userid = isset($params[0]) ? $params[0] : null;
        $key = isset($params[1]) ? $params[1] : null;
        $target = isset($params[2]) ? $params[2] : 0;
        $categoryKey = isset($params[3]) ? $params[3] : null;

        $auth = new AuthSession();
        $login = $auth->checkLogin($userid, $key);
        if (!$login) {
            return array('code' => RESULT_FAILURE, 'errorcode' => ERROR_LOGIN_STATE_MISSMATCH, 'errormsg' => "don't login");
        }
        if ($categoryKey === null || $categoryKey === '') {
            return array('code' => RESULT_FAILURE, 'errormsg' => 'categoryKey is required.');
        }

        $db = $auth->connectionDb($target);
        // del_fg=0の行のみ、自分のcategory_keyの範囲だけを返す（他機能の行は触らない）
        $rows = $db->query(
            "select * from _properties where category_key = ? and del_fg = 0 order by id",
            array($categoryKey)
        );
        $db->close();

        // DBConnection::query()はDB未接続時にnullを返す（falseとは別の失敗値）。
        // ===falseだけだとこのケースを見逃し、output:nullのまま「成功」を返してしまう
        // （DbManagerTInetUserAuth.phpと同じ修正。2026-10-09）
        if ($rows === false || $rows === null) {
            return array('code' => RESULT_FAILURE, 'errormsg' => $db->errMsg ?: 'DB接続に失敗しました');
        }
        return array('code' => RESULT_SUCCESS, 'output' => $rows);
    }

    // 追加/更新。$arg[0] = [userid, key, target, categoryKey, data]。
    // dataは1件ずつ {updatemark: "INSERT"|"UPDATE", ...列の値} という連想配列の配列
    public function update($arg)
    {
        // $arg[0][N]という2次元アクセスを繰り返すと分かりづらいので、
        // 最初に$paramsへ展開してから、以降は1次元の$params[N]で読む
        $params = isset($arg[0]) ? $arg[0] : array();
        $userid = isset($params[0]) ? $params[0] : null;
        $key = isset($params[1]) ? $params[1] : null;
        $target = isset($params[2]) ? $params[2] : 0;
        $data = isset($params[4]) ? $params[4] : null;

        $auth = new AuthSession();
        $login = $auth->checkLogin($userid, $key);
        if (!$login) {
            return array('code' => RESULT_FAILURE, 'errorcode' => ERROR_LOGIN_STATE_MISSMATCH, 'errormsg' => "don't login");
        }

        $db = $auth->connectionDb($target);
        $result = RESULT_SUCCESS;
        $errorcode = 0;
        $errormsg = '';

        // $dataはJSON配列[...]由来なので、json_decodeの第2引数（true/false）に
        // 関わらず常にPHPの配列になる（ここは影響を受けない）。影響があるのは、
        // 配列の中の1件（JSONオブジェクト{...}由来）である$infoの方。gateway.phpが
        // json_decode()をtrue無しで呼んでいるため、$infoはstdClassオブジェクトに
        // なり、以降isset($info->...)/property_exists($info, ...)/$info->...で
        // アクセスする（本番側の方式に統一。2026-10-09）
        if (is_array($data)) {
            $now = date('Y-m-d H:i:s');
            foreach ($data as $info) {
                $updatemark = isset($info->updatemark) ? $info->updatemark : null;
                $categoryKey = isset($info->category_key) ? $info->category_key : null;

                if ($updatemark === 'INSERT') {
                    // category_idはcategory_key内の連番（2026-10-02、既存データの実際の
                    // 運用パターンに合わせた。MAX(category_id)+1方式）。idの流用はやめた
                    // （idはテーブル全体のAUTO_INCREMENTで、既存データのcategory_idとは
                    // 値が噛み合わない＝既存の運用慣習と見た目が揃わないため）。
                    // 【採番衝突について】MAX()+1方式は同時書き込みで衝突しうるが、この
                    // テーブルはENGINE=MyISAMでトランザクション非対応な上、この機能の
                    // 書き込み頻度は低い（運用担当者が除外リストを編集する程度）ため許容する
                    $maxRows = $db->query(
                        "select max(category_id) as max_id from _properties where category_key = ?",
                        array($categoryKey)
                    );
                    $nextCategoryId = 1;
                    if ($maxRows !== false && isset($maxRows[0]['max_id']) && $maxRows[0]['max_id'] !== null) {
                        $nextCategoryId = intval($maxRows[0]['max_id']) + 1;
                    }

                    $ret = $db->execute(
                        "insert into _properties
                            (category_key, category_id, value1_1, value1_2, value1_3, value1_4, value1_5, update_date, valid_fg, del_fg)
                            values (?, ?, ?, ?, ?, ?, ?, ?, 1, 0)",
                        array(
                            $categoryKey,
                            $nextCategoryId,
                            isset($info->value1_1) ? $info->value1_1 : null,
                            isset($info->value1_2) ? $info->value1_2 : null,
                            isset($info->value1_3) ? $info->value1_3 : null,
                            isset($info->value1_4) ? $info->value1_4 : null,
                            isset($info->value1_5) ? $info->value1_5 : null,
                            $now,
                        )
                    );
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
                        // $info->$col は「変数$colの値をプロパティ名として使う」書き方
                        if (property_exists($info, $col)) {
                            $setParts[] = "$col = ?";
                            $values[] = is_bool($info->$col) ? ($info->$col ? 1 : 0) : $info->$col;
                        }
                    }
                    $values[] = $info->id;
                    // _properties は複数機能の相乗りテーブルのため、idだけでなく
                    // category_keyも一致する行だけを更新する（他機能の行を誤って
                    // 書き換えてしまう事故を防ぐ）。呼び出し側は必ずcategory_keyを渡すこと
                    $values[] = $categoryKey;

                    $ret = $db->execute(
                        "update _properties set " . implode(', ', $setParts) . " where id = ? and category_key = ?",
                        $values
                    );
                } else {
                    // 物理DELETEは意図的にサポートしない（docs/AMFPHP連携_差分除外リスト.md参照）
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
