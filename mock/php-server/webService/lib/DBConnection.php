<?php
// docs/legacy-amfphp/webService/lib/DBConnection.php（客先実物のOCR復元版）と
// 同じインターフェース（connect/query/execute/close/lastInsertId等）を持つ、
// SQLite向けの開発用スタブ。
//
// 本物との違い（意図的な簡略化）：
// - MySQLへの接続(host/user/password)ではなく、SQLiteファイルパスを使う。
//   connect()の引数は本物と同じ4つ(url, user, password, database)を受け取るが、
//   モックでは $database だけをSQLiteファイルパスとして使い、他3つは使わない
// - Log::sql/info/debug/error への記録は行わない（モックにログ基盤が無いため）
// - 初回接続時にテーブルが無ければ作る処理は、本物には無いモック固有の追加
//   （本物は既存のMySQLに繋ぐだけなのでテーブル作成は不要）
//
// query()/execute()の引数の受け方（プレースホルダ"?"の配列 or 名前付きプレースホルダの
// 連想配列）・戻り値の形は本物に合わせてある

class DBConnection
{
    public $url;
    public $database;
    public $user;
    public $password;
    public $dbh;    // DB接続ハンドル（接続後にPDOオブジェクトが入る）
    public $status; // 直前の処理が成功したか（true/false）
    public $errMsg; // 直前のエラーメッセージ

    public function __construct()
    {
        $this->url = '';
        $this->database = '';
        $this->user = '';
        $this->password = '';
        $this->dbh = false;
        $this->status = true;
        $this->errMsg = '';
    }

    // 本物は connect($url, $user, $password, $database) でMySQLに繋ぐが、
    // モックは $database をSQLiteファイルパスとして使うだけ（他3引数は受け取るが未使用）
    public function connect($url, $user, $password, $database)
    {
        $this->status = true;
        $this->url = $url;
        $this->database = $database;
        $this->user = $user;
        $this->password = $password;

        $isNew = !file_exists($database);
        try {
            $this->dbh = new PDO('sqlite:' . $database);
            $this->dbh->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        } catch (Exception $e) {
            $this->dbh = false;
            $this->status = false;
            $this->errMsg = 'database connection failed.';
            return $this->status;
        }

        // [モック固有] 初回だけテーブルを作る。本物のDBConnection::connect()には無い処理
        if ($isNew) {
            foreach (array('t_inet_user_auth', 't_inet_user_auth_ds3') as $table) {
                $this->dbh->exec("CREATE TABLE $table (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT, password TEXT, comment TEXT, number INTEGER,
                    submission_date TEXT, regist_date TEXT,
                    company_cd TEXT, company_name TEXT,
                    store_cd TEXT, store_name TEXT,
                    company_store_cd TEXT, company_store_branch_num TEXT,
                    non_sync INTEGER DEFAULT 0, delfg INTEGER DEFAULT 0,
                    reg_date TEXT, upd_date TEXT
                )");
            }
        }

        return $this->status;
    }

    // INSERT/UPDATE/DELETE用。$valuesは "?" プレースホルダに対応する配列
    public function execute($sql, $values = null)
    {
        if ($this->dbh == false) return null;

        try {
            $stmt = $this->dbh->prepare($sql);
            if ($values) {
                $res = $stmt->execute($values);
            } else {
                $res = $this->dbh->query($sql);
            }
        } catch (PDOException $pdoexception) {
            $this->status = false;
            $this->errMsg = "exception error. code:" . $pdoexception->getCode() . ", message:" . $pdoexception->getMessage();
            return $this->status;
        }

        return $res;
    }

    public function lastInsertId()
    {
        return $this->dbh->lastInsertId();
    }

    public function lastInsertIdIntVal()
    {
        return intval($this->dbh->lastInsertId());
    }

    // SELECT用。$valuesを渡すとプリペアドステートメント（"?"の配列 or 名前付き
    // プレースホルダの連想配列の両方に対応）、渡さなければ単純なクエリになる
    public function query($sql, $values = null, $nolog = false)
    {
        if ($this->dbh == false) return null;

        try {
            if ($values) {
                $stmt = $this->dbh->prepare($sql);
                if (array_values($values) === $values) {
                    // ただの配列（連番）→ "?" に1番目から順に割り当てる
                    $i = 1;
                    foreach ($values as $value) {
                        $stmt->bindValue($i, $value);
                        $i++;
                    }
                    $stmt->execute();
                } else {
                    // 連想配列 → 名前付きプレースホルダにそのまま対応づける
                    $stmt->execute($values);
                }
                return $stmt->fetchAll(PDO::FETCH_ASSOC);
            } else {
                $rows = $this->dbh->query($sql)->fetchAll(PDO::FETCH_ASSOC);
                if ($rows == false) {
                    $this->status = false;
                    $errorInfo = $this->dbh->errorInfo();
                    $this->errMsg = $errorInfo[1] . ":" . $errorInfo[2];
                }
                return $rows;
            }
        } catch (PDOException $exception) {
            $this->status = false;
            $this->errMsg = "exception error. code:" . $exception->getCode() . ", message:" . $exception->getMessage();
            return $this->status;
        }
    }

    public function close()
    {
        $this->dbh = null;
        return $this->status;
    }
}
