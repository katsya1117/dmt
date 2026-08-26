<?php
require_once __DIR__ . '/../../lib/DBConnection.php';

// docs/legacy-amfphp/webService/amfphp/Services/AuthSession.php（客先実物のOCR復元版）と
// 同じインターフェース（checkLogin/connectionDb）を持つ、開発用のモック。
//
// 本物との違い（意図的な簡略化）：
// - checkLogin()は本物のようにt_mng_adminテーブルと照合せず、userid/keyが
//   空でないことだけを見る（モックにt_mng_adminテーブルが無いため）
// - connectionDb($select)は本物のようにプライマリ/レプリカで別サーバーに
//   繋ぎ分けはせず、$selectの値に関わらず同じSQLiteファイルに繋ぐ
//   （if/elseの構造自体は本物に合わせて残してある）

class AuthSession
{
    public function checkLogin($userid, $key)
    {
        return !empty($userid) && !empty($key);
    }

    // $select: 本物は 0=プライマリDB / 0以外=レプリカDB。
    // モックは接続先を分けていないが、呼び出し側のコードは本物と同じ形にできるよう
    // if/elseの構造自体は残してある
    public function connectionDb($select)
    {
        $dbPath = __DIR__ . '/../../../data/amfphp_mock.sqlite';
        $db = new DBConnection();
        if ($select == 0) {
            $db->connect('', '', '', $dbPath);
        } else {
            $db->connect('', '', '', $dbPath);
        }
        return $db;
    }
}
