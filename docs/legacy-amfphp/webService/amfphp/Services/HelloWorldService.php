<?php
// このファイルが「AMFPHP経由で呼び出されるサービスクラス」の実体。
// gateway.php が受け取ったJSONの serviceName: "HelloWorldService" が
// このファイル名・クラス名に対応し、methodName がこの中の関数名に対応する
require_once '../config.php';

class HelloWorldService
{
    /**
     * Hello!
     */
    // 【public とは】このメソッドが外部（ここではAMFPHP経由）から呼び出せる
    // ことを示すアクセス修飾子。JS/TSのpublicと同じ考え方
    public function ShowHello()
    {
        // 【__CLASS__ / __METHOD__ / __LINE__ とは】いずれも「マジック定数」と
        // 呼ばれる特殊な定数で、書いた場所に応じて自動的に値が決まる。
        // __CLASS__ は今いるクラス名、__METHOD__ は「クラス名::メソッド名」、
        // __LINE__ はその行の行番号にそれぞれ置き換わる（ログにどこで何が
        // 起きたか出すための定型パターン）
        Log::debug(OPERATION_LOG, "[" . __CLASS__ . ":" . __METHOD__ . "]start " . __LINE__);
        // 【連想配列への代入】$ret という変数は事前に宣言せず、いきなり
        // $ret["result"] = 0 と書くだけで「連想配列（キーが"result"）」として
        // 自動的に作られる。PHPは変数の型宣言が要らない緩い言語
        $ret["result"] = 0;
        $ret["message"] = "Hello !";
        // 【戻り値の形】このアプリの全サービスメソッドは
        // { result: 0（成功）または1（失敗）, message: 文字列 } という同じ形の
        // 連想配列を返す規約になっている（index.htmlのresult.messageの読み方と対応）
        return $ret;
    }

    /**
     * 引数指定
     */
    public function callParametersMethod($args1, $args2)
    {
        Log::debug(OPERATION_LOG, "[" . __CLASS__ . ":" . __METHOD__ . "]start " . __LINE__);
        Log::debug(OPERATION_LOG, "args1 dump" . __LINE__, false, $args1);
        Log::debug(OPERATION_LOG, "args2 dump" . __LINE__, false, $args2);
        $ret["result"] = 0;
        $ret["message"] = "Hello !";
        return $ret;
        // 【引数とindex.htmlの対応】index.html側では
        // parameters: ["carcd", "hogehoge"] のように配列で値を渡していた。
        // AMFPHPがその配列を順番に $args1, $args2 という引数へ割り当てて
        // このメソッドを呼び出す（配列の1番目→1個目の引数、という対応）
    }

    /**
     * DB access
     */
    public function callCarInformation($carCd)
    {
        Log::debug(OPERATION_LOG, "[" . __CLASS__ . ":" . __METHOD__ . "]start " . __LINE__);
        Log::debug(OPERATION_LOG, "target carcd dump" . __LINE__, false, $carCd);
        // 【try/catch】DB接続やSQL実行はエラーが起きうる処理なので、
        // 例外(Exception)が投げられても丸ごとプログラムが落ちないよう
        // try の中に書き、catch でまとめて拾う
        try {
            // DBConnection.php で見たクラス。使うたびに new して接続し直す設計
            $db = new DBConnection();
            // DB_HOST / DB_USER / DB_PASS / DB_NAME は、ファイル冒頭で
            // require_once した config.php 側で定義されているはずの定数
            // （まだ内容を入手できていない）
            $db->connect(DB_HOST, DB_USER, DB_PASS, DB_NAME);
            $values = array();
            // 【:carcd というプレースホルダ】SQL文の中に直接値を埋め込まず、
            // ":carcd" という名前の「あとで埋める場所」を用意しておく書き方
            // （DBConnection::query() のプリペアドステートメントの説明を参照）
            $query = "select * from t_car where carcd=:carcd";
            $values["carcd"] = $carCd;
            // $query（プレースホルダ入りSQL）と $values（埋め込む値）を渡して実行
            $result = $db->query($query, $values);
            Log::debug(OPERATION_LOG, "query result " . __LINE__, false, $result);
            $ret["result"] = 0;
            // 【json_encode() とは】PHPの配列/連想配列をJSON文字列に変換する
            // 関数（JSの JSON.stringify() に相当）。DBから取れた結果（PHPの
            // 配列）を、そのままではなく一度JSON文字列にしてから message に
            // 詰めている＝呼び出し側（index.html）で JSON.parse() し直す必要が
            // あった理由がここ
            $ret["message"] = json_encode($result);
            return $ret;
        } catch (Exception $e) {
            // 【Exception とは】PHPの例外クラスの中で一番基本的な汎用クラス
            // （DBConnection.php では PDOException というDB専用の例外だけを
            // 拾っていたが、ここではDB以外のエラーも含めて広く拾っている）
            Log::error(OPERATION_LOG, "query error. message:" . $e->getMessage() . __LINE__, true, $e);
            $ret["result"] = 1;
            $ret["message"] = $e->getMessage();
            return $ret;
        }
    }
}
