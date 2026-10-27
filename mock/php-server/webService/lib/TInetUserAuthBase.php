<?php
require_once __DIR__ . '/../amfphp/Services/AuthSession.php';
require_once __DIR__ . '/TInetUserAuthWriter.php';

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
// 【本物とここで挙動が分かれる点】本物（docs/legacy-amfphp/配下のOCR復元版、
// 客先の旧FLEXアプリが今も使う実運用コード）はAMFPHPの通信インターフェース
// （{serviceName, methodName, parameters}というJSON-RPC的な形）だけ流用し、
// CRUD処理の中身・引数の並びは新アプリ専用の新規実装で旧アプリとは共有していない。
// そのため、以下の点は本物と異なる（2026-10-09方針確定）：
// - update()のUPDATE分岐は本当の部分更新（$infoに含まれる列だけをSET句に組み込む）
//   にしている（本物は「SET句が全カラム固定」。DbManagerProperties.phpと同じ方式）
// - targetTableId（本物にある、通常/DIAG用の2テーブルを選ぶ引数）は廃止した。
//   テーブルは引数で選ばず、サービスクラス（DbManagerTInetUserAuth＝通常 /
//   DbManagerTInetUserAuthDiag＝DIAG用）で選ぶ。load/updateの実装は両者共通で、
//   このベースクラスに置き、サブクラスが $table だけを定義する。
//   複数テーブルに波及する操作が必要になった場合も、引数で選ばず専用メソッド名で
//   表現する方針

// 【define() とは】PHPで定数を作る組み込み関数。define('名前', 値)と書くと、
// classやfunctionの外で定義してもプログラム全体どこからでもその名前で値を
// 参照できるようになる（JSのconstに近いが、スコープがより広い）
define('RESULT_SUCCESS', 0);   // $resultValue["code"]がこの値なら成功
define('RESULT_FAILURE', -1);  // 失敗
define('ERROR_LOGIN_STATE_MISSMATCH', 7); // ログイン確認に失敗した時のerrorcode

// アカウント認証系テーブル（通常・DIAG用は同じ構造）のload/updateの共通実装。
// gateway.phpはServices/配下のクラスだけを呼び出せるため、この抽象クラスは
// lib/に置いて直接は公開しない（サブクラス経由でのみ呼ばれる）
abstract class TInetUserAuthBase
{
    // 操作対象のテーブル名。サブクラスが定義する（引数で選べない固定値）
    protected $table = '';

    // 一覧取得。gateway.phpがcall_user_func_arrayで引数を展開して渡すため、
    // (userid, key, target)を直接引数として受け取る（データ部分は無い）。
    // 全引数にデフォルト値を付けているのは、想定より少ない引数しか来なかった
    // 場合でもArgumentCountErrorで落ちず、従来のisset(...)?:...と同じ安全性を
    // 保つため（2026-10-16方針変更。詳細はdocs/AMFPHP連携.md参照）
    public function load($userid = null, $key = null, $target = 0)
    {
        // 本物と同じく、位置0/1がuserid/key、AuthSession経由でログイン確認する
        $auth = new AuthSession();
        $login = $auth->checkLogin($userid, $key);
        if (!$login) {
            // ログイン確認NG。$resultValueに相当する連想配列をそのまま返す
            // （gateway.phpがこれをjson_encodeしてHTTPレスポンスにする）
            return array('code' => RESULT_FAILURE, 'errorcode' => ERROR_LOGIN_STATE_MISSMATCH, 'errormsg' => "don't login");
        }
        $table = $this->table;

        // target(位置2)をAuthSession::connectionDb()に渡し、接続済みDBConnectionを得る
        $db = $auth->connectionDb($target);
        // 本物と同じく、DBConnection::query()にSQLを渡すだけ（値の埋め込みが無いので
        // $valuesは省略）。PDO::FETCH_ASSOC相当（カラム名をキーにした連想配列の配列）で返る
        $rows = $db->query("select * from $table order by id");
        $db->close();

        // DBConnection::query()はDB未接続時にnullを返す（falseとは別の失敗値）。
        // ===falseだけだとこのケースを見逃し、output:nullのまま「成功」を返してしまう
        // （Express側がnullに対して配列操作をして初めてクラッシュする、分かりにくい
        // 壊れ方になる。2026-10-09修正）
        if ($rows === false || $rows === null) {
            return array('code' => RESULT_FAILURE, 'errormsg' => $db->errMsg ?: 'DB接続に失敗しました');
        }
        return array('code' => RESULT_SUCCESS, 'output' => $rows);
    }

    // 追加/更新（論理削除も'UPDATE'+delfg:trueで表現する。物理DELETEは
    // 意図的にサポートしない）。(userid, key, target, data)を直接引数として
    // 受け取る。dataは1件ずつ {updatemark: "INSERT"|"UPDATE", ...列の値} という
    // 連想配列の配列で、1回の呼び出しで複数件（追加・更新・論理削除が混在）を処理できる
    public function update($userid = null, $key = null, $target = 0, $data = null)
    {
        $auth = new AuthSession();
        $login = $auth->checkLogin($userid, $key);
        if (!$login) {
            return array('code' => RESULT_FAILURE, 'errorcode' => ERROR_LOGIN_STATE_MISSMATCH, 'errormsg' => "don't login");
        }
        $table = $this->table;

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
            $now = date('Y-m-d H:i:s'); // このバッチ内の全レコードで同じ日時にする
            foreach ($data as $info) {
                $written = TInetUserAuthWriter::write($db, $table, $info, $now);
                if ($written['skipped']) continue;
                $ret = $written['ok'];

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
