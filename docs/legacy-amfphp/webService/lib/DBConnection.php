<?php
// ↑ PHPファイルの先頭にはこの "<?php" タグが必須。ここから下がPHPコードとして実行される
// （HTMLの中にPHPを埋め込める言語なので、「ここからPHPですよ」という合図が要る）

/**
 * DBConnection
 *
 * データベース接続用基本クラス
 *
 */
class DBConnection {
  // ↑ classキーワードでクラスを定義。JS/TSのclassとほぼ同じ考え方

  // 【プロパティ（メンバ変数）宣言】
  // "var $名前;" は古い書き方（PHP4時代の名残）。今どきのPHPなら
  // "public $url;" と書く。意味は同じ（インスタンスごとに持つ変数）
  var $url;
  var $database;
  var $user;
  var $password;
  var $dbh;      // DB接続ハンドル（接続後にPDOオブジェクトが入る）
  var $sdb;
  var $status;   // 直前の処理が成功したか（true/false）
  var $errMsg;   // 直前のエラーメッセージ

  // 【コンストラクタとは】"new DBConnection()" した瞬間に自動で呼ばれる
  // 初期化メソッド。元はクラス名と同じ名前の関数（PHP4スタイル）で書かれて
  // いたが、PHP8ではその書き方が自動的にコンストラクタとして扱われなくなった
  // ため、標準の __construct() に書き直した
  function __construct() {
    // 【$this とは】JSでいう this と同じ。「今作られたインスタンス自身」を指す
    // 【-> とは】JSの "." に相当。インスタンスのプロパティ/メソッドにアクセスする演算子
    $this->url = '';
    $this->database = '';
    $this->user = '';
    $this->password = '';
    $this->dbh = false;
    $this->status = true;
    $this->errMsg = '';
  }

  // [ORIGINAL] PHP4スタイルのコンストラクタ（クラス名と同名のメソッド）。
  // PHP8では自動的にコンストラクタとして呼ばれなくなったため使われていない。
  // 参考として元ファイルのまま残す
  // function DBConnection() {
  //   $this->url = '';
  //   $this->database = '';
  //   $this->user = '';
  //   $this->password = '';
  //   $this->dbh = false;
  //   $this->status = true;
  //   $this->errMsg = '';
  // }

  // 【引数の書き方】TSのように型を書かなくてよい（緩い型付け言語）
  function connect($url, $user, $password, $database) {
    $this->status = true;
    $this->url = $url;
    $this->database = $database;
    $this->user = $user;
    $this->password = $password;

    // "//" で始まる行はコメントアウト（使われていない古いコードの名残）
    //$this->dbh = mysql_connect($this->url, $this->user, $this->password) or $this->dbh = false;

    // 【文字列の中の $変数 について】ダブルクォート " " の中に書いた $変数 は、
    // 自動的に値へ展開される（JSのテンプレートリテラル `${url}` に近い機能。
    // ただしPHPは "..." の中に直接 $url と書くだけでよく、${} は不要）
    $dns = "mysql:host=$url;dbname=$database;charset=utf8";
    // 【PDOとは】PHP標準のデータベース接続ライブラリ（Node.jsでいうpgやmysql2の
    // ドライバに近い役割）。new PDO(接続文字列, ユーザー名, パスワード) で接続する
    $this->dbh = new PDO($dns, $user, $password);
    // 【__METHOD__ とは】「今実行中のクラス名::メソッド名」に自動的に置き換わる
    // 特殊な定数（マジック定数）。ログにどこから呼ばれたか出すためのお決まり文句
    $msgHead = "[" . __METHOD__ . "]";

    // 【:: とは】クラスに属する（インスタンスを作らなくても呼べる）メソッドを
    // 呼び出す演算子。JSでいう ClassName.method() に相当（static呼び出し）
    // 【__LINE__ とは】この行の行番号に自動的に置き換わるマジック定数
    Log::info(OPERATION_LOG, "$msgHead DB connect. dns:$dns, user:$user " . __LINE__);
    if ($this->dbh == false) {
      Log::error(OPERATION_LOG, "$msgHead DB connect error." . $this->url . " user=" . $this->user . __LINE__);
      $this->status = false;
      $this->errMsg = 'database connection failed.';
      return $this->status;
    }

    // 例外処理を投げるようにする（throw）
    // 【PDO::ATTR_ERRMODE とは】PDOの動作モード設定。デフォルトはエラーが起きても
    // 黙って false を返すだけだが、ERRMODE_EXCEPTION にすると
    // 「SQL実行に失敗したら例外(throw)を投げる」動作に変わる（JSでいう
    // fetchが失敗したときrejectするか黙って失敗するか、のような違い）
    $this->dbh->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    return $this->status;
  }

  // 【デフォルト引数】"$values=null" はJS/TSの "values = null" と同じ意味
  // （呼び出し時に省略したらnullが入る）
  function execute($sql, $values = null) {
    $msgHead = "[" . __METHOD__ . "]";

    if ($this->dbh == false) return null;

    // [ORIGINAL] 定義されているが以降のコードで使われていない（元ファイルのまま）
    $regex = '/[|?]/';

    // 【try/catch とは】JSと同じ例外処理構文。tryの中で例外(throw)が起きたら
    // catchに飛ぶ
    try {
      // 【プリペアドステートメントとは】SQL文をテンプレートとして先にDBへ渡し、
      // 値は後から安全に差し込む仕組み。SQL文字列に直接値を連結しないため、
      // SQLインジェクション（悪意ある文字列でSQLを改ざんされる攻撃）を防げる
      $stmt = $this->dbh->prepare($sql);

      Log::sql(OPERATION_LOG, "$msgHead sql:$sql " . __LINE__);

      if ($values) {
        // prepareしたテンプレートに、実際の値をはめ込んで実行する
        $res = $stmt->execute($values);
        Log::debug(OPERATION_LOG, "$msgHead execute result: $res, debugDumpParams:", false, $this->debugLogDumpParams($stmt));
      } else {
        //$res = $stmt->query();
        $res = $this->dbh->query($sql);
        Log::debug(OPERATION_LOG, "$msgHead execute result" . __LINE__, false, $res);
      }
    } catch (PDOException $pdoexception) {
      // 【catch (型 $変数)】JSの catch (error) と違い、PHPは「どの型の例外を
      // 受け止めるか」を明示する（ここではPDO関連のエラーだけ受け止める）
      Log::debug(OPERATION_LOG, "$msgHead PDOException. " . $pdoexception->getMessage() . " : " . __LINE__, false, $pdoexception);

      $this->status = false;
      $this->errMsg = "exception error. code:" . $pdoexception->getCode() . ", message:" . $pdoexception->getMessage();
      return $this->status;
    }

    return $res;
  }

  function lastInsertId() {
    // 直前のINSERTで自動採番されたID（例：account_authテーブルのid）を取得する
    return $this->dbh->lastInsertId();
  }

  function lastInsertIdIntVal() {
    // 【intval() とは】文字列などを整数に変換する関数（JSの parseInt() に近い）
    return intval($this->dbh->lastInsertId());
  }

  function debugLogDumpParams($stmt) {
    // 【出力バッファリングとは】PHPは本来 echo などで書いた内容がそのまま
    // ブラウザ画面に出力される言語。ob_start() すると、その出力を画面に流さず
    // 一旦バッファ（メモリ上の領域）に貯めておける。ここでは
    // $stmt->debugDumpParams()（画面に直接テキストを出す関数）の出力結果を
    // 画面に出さず、文字列として obtain（$out）してログに使うためのテクニック
    ob_start();
    $stmt->debugDumpParams();
    $out = ob_get_contents(); // ここまでにバッファに貯まった内容を文字列として取得
    ob_end_clean();           // バッファを画面に出さずに破棄（後片付け）
    return $out;
  }

  function query($sql, $values = null, $nolog = false) {
    $msgHead = "[" . __METHOD__ . "]";

    if ($this->dbh == false) return null;

    // [ORIGINAL] 定義されているが以降のコードで使われていない（元ファイルのまま）
    $regex = '/[|?]/';

    try {
      if ($values) {
        Log::sql(OPERATION_LOG, "$msgHead sql:" . ($nolog ? "no log" : $sql) . ":" . __LINE__);

        $stmt = $this->dbh->prepare($sql);

        // 【array_values($values) === $values について】
        // PHPの配列には2種類の使い方がある。
        //   パターンA: ただの配列（添字が0,1,2と連番）の例 -- 'a', 'b', 'c'
        //   パターンB: 連想配列（キーが名前）の例 -- carcd = '123'
        // array_values() はキーを取り除いて連番の配列に作り直す関数。
        // 「作り直した結果が元と同じ」＝「元々パターンAのただの配列だった」と
        // 判定するためのイディオム（TSでいう Array.isArray に近い目的だが
        // 仕組みは違う）
        if (array_values($values) === $values) {
          $i = 1;
          // 【foreach とは】PHPの配列/連想配列を1件ずつ取り出すループ構文。
          // JSの for...of に近い
          foreach ($values as $value) {
            // パターンAの場合はプレースホルダ（"?"）に1番目から順に値を割り当てる
            $stmt->bindValue($i, $value);
            if ($nolog == false) Log::sql(OPERATION_LOG, "sql bind $i: $value");
            $i++;
          }
          $stmt->execute();
        } else {
          // 連想配列の場合はそのまま設定する
          // （②の場合は execute() に連想配列をそのまま渡すと、SQL側の
          // ":carcd" のような名前付きプレースホルダに自動で対応づけてくれる）
          Log::sql(OPERATION_LOG, "sql bind :" . __LINE__, false, $values);
          $stmt->execute($values);
        }

        Log::sql(OPERATION_LOG, "$msgHead execute debugDumpParams " . __LINE__, false, $this->debugLogDumpParams($stmt));

        // 【PDO::FETCH_ASSOC とは】SELECT結果を「カラム名をキーにした連想配列」の
        // 配列として受け取る指定（例: [["id"=>1,"name"=>"a"], ["id"=>2,"name"=>"b"]]）
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        Log::sql(OPERATION_LOG, "$msgHead fetchAll " . __LINE__, false, $rows);
        return $rows;
      } else {
        Log::sql(OPERATION_LOG, "$msgHead sql:" . ($nolog ? "no log" : $sql) . ":" . __LINE__);

        $rows = $this->dbh->query($sql)->fetchAll(PDO::FETCH_ASSOC);
        if ($rows == false) {
          $this->status = false;
          // [ORIGINAL] mysql_errno/mysql_error は古いmysql拡張の関数で、PHP7で
          // 廃止済み。PDOを使っている現在のコードでは呼び出せない（移行時の
          // 消し忘れと思われる）ため、PDOのエラー情報取得方法に置き換えた
          // $this->errMsg = mysql_errno($this->dbh) . ":" . mysql_error($this->dbh);
          // 【PDO::errorInfo() とは】直前のステートメント実行に関するエラー情報を
          // [SQLSTATE, ドライバ固有のエラーコード, ドライバ固有のエラーメッセージ]
          // の配列で返すPDOのメソッド（mysql_errno/mysql_errorの代替）
          $errorInfo = $this->dbh->errorInfo();
          $this->errMsg = $errorInfo[1] . ":" . $errorInfo[2];
          Log::error(OPERATION_LOG, "$msgHead query false" . $this->errMsg . ":" . __LINE__);
        }
        return $rows;
      }
    } catch (PDOException $exception) {
      Log::error(OPERATION_LOG, "$msgHead query exception error. code:" . $exception->getCode() . ", message:" . $exception->getMessage() . ":" . __LINE__);

      $this->status = false;
      $this->errMsg = "exception error. code:" . $exception->getCode() . ", message:" . $exception->getMessage();
      return $this->status;
    }
    // [ORIGINAL] catch節の後に "return #result;" というOCR不明瞭な行があったが、
    // 到達不可能なコード（tryもcatchも既にreturn済み）と思われるため復元せず削除した。
    // 元のPHPファイルで実際に何が書かれていたか要確認
  }

  function close() {
    //mysql_close($this->dbh) or $this->status = false;
    $this->dbh = null;

    //if ($this->status == false) {
    //  $this->errMsg = mysql_errno() . ": " . mysql_error();
    //}
    // return $this->status;
    return $this->status;
  }

  //function escape($value) {
  //  return mysql_real_escape_string($value, $this->dbh);
  //}
}
