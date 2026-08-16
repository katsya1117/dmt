<?php
/**
 * Log
 *
 * ログ出力用クラス
 *
 */

// 【define() とは】PHPで「定数」を定義する関数（JSのconstに近いが、
// classやfunctionの外で定義してもプログラム全体どこからでも参照できる、
// より広いスコープを持つ）。define('名前', 値) という書き方
//
// ここでは "ログの種別" を表す定数を2つ用意している。値も同じ文字列
// （'OPERATION_LOG'）にしているのは、後で見比べる時に分かりやすくするため
// （PHPの define は「定数名」と「値」を別々に指定できる点に注意。他の言語の
// enumのように名前だけで完結しない）
define('OPERATION_LOG', 'OPERATION_LOG');
define('EXPORT_LOG', 'EXPORT_LOG');

// TARGET_LEVEL：これ以上のレベルはログに出さない、というしきい値
define('TARGET_LEVEL', 5);
// ログの重大度レベル（数字が大きいほど詳細・軽微な情報）
define('LEVEL_DEBUG', 4);
define('LEVEL_SQL', 3);
define('LEVEL_INFO', 2);
define('LEVEL_WARN', 1);
define('LEVEL_ERROR', 0);

// [ORIGINAL] 以下4つはLEVEL_*と同じ意味の定数に見えるが、このファイル内では
// 使われている箇所が見当たらない（元ファイルのまま残す）
define('LOG_LVL_ERR', 0);
define('LOG_LVL_WAR', 1);
define('LOG_LVL_INF', 2);
define('LOG_LVL_SQL', 3);
define('LOG_LVL_DEB', 4);

class Log
{
  // 【static とは】インスタンス（new Log()）ごとではなく、クラス自体が1つだけ
  // 持つ変数・メソッドにするキーワード。JS/TSのstaticと同じ考え方。
  // このクラスは実際、一度も new されず Log::debug(...) のように
  // クラス名から直接呼ぶ使われ方しかしていない（後述のstatic functionたちも同様）
  static $output = true;

  //function OUT($value) {
  // 【public static function とは】「外部から」かつ「newせずクラス名から直接」
  // 呼べるメソッド、という意味で public と static を両方付けている
  public static function OUT($value)
  {
    //2010/12/03 asaoka@ai : log output save
    Log::debug(OPERATION_LOG, $value);
    return;

    // [ORIGINAL] 上のreturnで必ず抜けるため、以下は到達しないコード（元ファイルのまま）
    // 【到達しないコードとは】returnで関数を抜けた後に書かれた処理は、
    // どんな条件でも実行されない。おそらく昔はここが本体で、後から
    // 「Log::debugに任せる」よう変更した際、削除し忘れた古いコードと思われる
    if (false == Log::$output) return; //2010/12/03 asaoka@ai : log output save
    $today = getdate(); // 現在日時を要素ごとの連想配列で取得するPHP組み込み関数
    // 【sprintf() とは】値を指定した書式（桁数など）の文字列に整形する関数。
    // "%02d" は「2桁になるようゼロ埋めする整数」という意味（JSでいう
    // String(n).padStart(2, '0') に相当）
    $nowtime = sprintf("%02d:%02d:%02d", $today["hours"], $today["minutes"], $today["seconds"]);
    $today = sprintf("%04d%02d%02d", $today["year"], $today["mon"], $today["mday"]);
    $mode = "a"; // ファイルへの書き込みモード。"a" は追記（append）
    if (file_exists(LOG_FILE_SQL) == false) {
      $mode = "w"; // ファイルがまだ無ければ新規作成（write）モードにする
    }
    // 【fopen/fwrite/fclose とは】PHPでファイルに書き込む基本の3点セット。
    // 開く→書く→閉じる、という手続き型のI/O（Node.jsのfs.writeFileと違い、
    // 開いたままにしておける低レベルAPI）
    $fp = fopen(LOG_FILE_SQL, $mode);
    fwrite($fp, "[$today $nowtime] $value \n");
    fclose($fp);
  }

  // for php8
  //static $labels = ["ERR", "WAR", "INF", "SQL", "DEB"]; // php 8.0 >=
  // 【array() と [] の違い】どちらも配列を作る書き方で意味は同じ。
  // array(...) はPHPの伝統的な書き方、[...] はPHP5.4以降で使える短縮記法。
  // このコードはPHP7以前（8.0未満）向けに古い書き方の方を使っている
  //
  // 【添字とレベル定数の対応】この配列のインデックス0,1,2,3,4が、
  // 上で定義した LEVEL_ERROR(0) / LEVEL_WARN(1) / LEVEL_INFO(2) /
  // LEVEL_SQL(3) / LEVEL_DEBUG(4) の値とそのまま対応している
  // （$labels[0] === "ERR" のように使われる）
  static $labels = array("ERR", "WAR", "INF", "SQL", "DEB"); // php 8.0 <

  // ここから下、error/warn/info/sql/debug の5つは、どれも「レベルだけ違う
  // 薄いラッパー」で、最終的には logout() という共通メソッドに処理を渡している
  // （JSでいう console.error/warn/info が全部同じ内部実装を呼んでいるのに近い）
  public static function error($type, $value, $dump = null)
  {
    // error だけ、スタックトレースを取るかどうかの引数を挟まず true 固定。
    // 「エラーは常に呼び出し履歴を残す」という設計判断と思われる
    Log::logout($type, LEVEL_ERROR, $value, true, $dump);
  }

  public static function warn($type, $value, $isStackTrace = false, $dump = null)
  {
    // 【三項演算子 A ? B : C】「Aが真ならB、そうでなければC」という値を選ぶ
    // 書き方。JS/TSと全く同じ構文
    $stackTrace = $isStackTrace ? debug_backtrace() : "";
    Log::logout($type, LEVEL_WARN, $value, $stackTrace, $dump);
  }

  public static function info($type, $value, $isStackTrace = false, $dump = null)
  {
    $stackTrace = $isStackTrace ? debug_backtrace() : "";
    Log::logout($type, LEVEL_INFO, $value, $stackTrace, $dump);
  }

  public static function sql($type, $value, $isStackTrace = false, $dump = null)
  {
    $stackTrace = $isStackTrace ? debug_backtrace() : "";
    Log::logout($type, LEVEL_SQL, $value, $stackTrace, $dump);
  }

  public static function debug($type, $value, $isStackTrace = false, $dump = null)
  {
    $stackTrace = $isStackTrace ? debug_backtrace() : "";
    Log::logout($type, LEVEL_DEBUG, $value, $stackTrace, $dump);
  }

  // 実際にファイルへログを書き出す本体メソッド（error/warn/info/sql/debugは
  // 全員ここに集約される）
  public static function logout($type, $level, $value, $stackTrace = "", $dump = null)
  {
    // レベル値がしきい値(TARGET_LEVEL=5)より大きければ何もせず抜ける。
    // ただし現状 LEVEL_* の最大値は4(DEBUG)なので、この条件が成立することは
    // 実質無く、常に全レベルがログ出力される設定になっている
    if ($level > TARGET_LEVEL) return;

    // [ORIGINAL] LOG_FOLDER / LOG_PATH / LOG_FILE / REMOTE_ADDR はこのファイルでは
    // 定義されていない。config.php 側で定数定義されている想定
    $logFilePath = LOG_FOLDER;
    // 【== と === の違い】PHPには「値が同じならtrue」の == と、
    // 「値も型も同じならtrue」の === がある（JS/TSの == / === と同じ関係）。
    // ここでは == を使っているので、型の違いは気にせず値だけ見ている
    if ($type == OPERATION_LOG) {
      $logFilePath .= LOG_PATH . LOG_FILE; // .= は「末尾に文字列を連結して代入」
    } else if ($type == EXPORT_LOG) {
      $logFilePath .= LOG_PATH . LOG_FILE;
    } else {
      // 【error_log() とは】PHP標準の、サーバーのエラーログへ書き込む組み込み
      // 関数（このクラス独自のログ機構が使えない状況向けの最終手段）
      error_log("undefined log type. log type:$type");
      return;
    }

    $stack = "";
    // 【is_array() とは】値が配列かどうかを調べる関数。呼び出し元（error等）が
    // $stackTrace に debug_backtrace()（＝配列）を渡していれば true になる
    if (is_array($stackTrace)) {
      $stack = "\n stack trace start_";
      // 【debug_backtrace() とは】「今この場所に至るまでに、どのファイルの
      // どの関数から呼ばれてきたか」の履歴を配列で返すPHP組み込み関数
      // （JSのError().stackに近い情報を、構造化された配列で取れるイメージ）
      $dbg = debug_backtrace();
      foreach ($dbg as $dbgrow) {
        // 【array_key_exists() とは】連想配列に指定したキーが存在するかを
        // 調べる関数（TSの "in" 演算子に近い）。無ければ空文字にして
        // エラーを避けている（存在しないキーへの直接アクセスは警告になるため）
        $stackFile = array_key_exists("file", $dbgrow) ? $dbgrow['file'] : "";
        $stackFunction = array_key_exists("function", $dbgrow) ? $dbgrow['function'] : "";
        $stackLine = array_key_exists("line", $dbgrow) ? $dbgrow['line'] : "";
        $stackClass = array_key_exists("class", $dbgrow) ? $dbgrow['class'] . "::" : "";
        $stack .= "\n$stackFile/$stackClass$stackFunction/$stackLine";
        // 【{$dbgrow['file']} という書き方】ダブルクォート文字列の中で
        // 連想配列の要素を直接埋め込みたい時、$dbgrow['file'] のままだと
        // 曖昧になる場合があるため {} で囲んで範囲をはっきりさせる書き方
        // （$dbgrow['file'] と書いた場合とほぼ同じ意味）
        $stack .= "\n{$dbgrow['file']}/{$dbgrow['function']}/{$dbgrow['line']}";
      }
      $stack .= "\n__stack trace end__";
    }

    $dumpValue = "";
    // 【isset() とは】変数が「定義されていて、かつnullでない」かを調べる関数
    if (isset($dump)) {
      // ここも debugLogDumpParams() と同じ「出力バッファリング」のテクニック。
      // var_dump()（画面に直接ダンプ内容を出す関数）の出力を、画面に出さず
      // 文字列として捕まえてログに使っている
      ob_start();
      var_dump($dump);
      $out = ob_get_contents();
      ob_end_clean();
      //Log::OUT($out);
      $dumpValue = "\n### dump start ### \n$out\n ### dump end ###";
    }

    // ここまで数値だった $level を、"ERR"などの文字列ラベルに置き換えている
    // （変数を別の型の値で「上書き」できるのもPHPの緩い型付けの特徴）
    $level = Log::$labels[$level];
    // 【getmypid() とは】今動いているPHPプロセスのID（OSが割り振る番号）を
    // 取得する関数。同時に複数リクエストが処理されている時、ログがどの
    // リクエスト由来か見分けるために使う
    $pid = getmypid();

    // php 8.0 or under version
    //$dtStr = date("Y-m-d H:i:s") . "." . substr(explode(".", (microtime(true) . ""))[1], 0, 3); // php 8.0
    // Below version php 8.0
    // 【microtime(true) とは】現在時刻を「1970年からの経過秒数」を
    // 小数点付き（ミリ秒精度）で返す関数。日付だけでなくミリ秒までログに
    // 残すため、いったん文字列にして "." で分割し、小数部分だけ取り出している
    $nowTime = explode(".", (microtime(true) . ""));
    //$dtStr = date("Y-m-d H:i:s") . "." . substr($mTimeAry[1], 0, 3);
    // 【date("Y-m-d H:i:s") とは】現在時刻を指定した書式の文字列にする関数。
    // Y-m-d H:i:s は「年-月-日 時:分:秒」というPHP独自の書式指定子
    // （JSのtoLocaleString等とは書式の書き方が違うので注意）
    $dtStr = date("Y-m-d H:i:s") . (count($nowTime) > 1 ? "." . substr($nowTime[1], 0, 3) : "");

    // 最終的に1行のログ文字列を組み立てる
    $message = "[$dtStr] [$pid] [" . REMOTE_ADDR . "] [$level] $value $stack $dumpValue\n";
    $fp = fopen($logFilePath, "a"); // "a" = 追記モードで開く
    fwrite($fp, $message);
    fclose($fp);
    // [ORIGINAL] 元のOCRテキストがここで途切れていた（fclose($fp);の後、
    // logout()・classの閉じ括弧が見えていない）。以下2行は推定で補完。
    // 原文と突き合わせての確認を推奨
  }
}
