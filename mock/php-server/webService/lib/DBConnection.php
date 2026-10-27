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

            // 権限マスタとユーザー権限（客先実物のDDLをSQLite向けに変換。MySQL固有構文は落とす）。
            // 日時列の綴りは registed_date（ユーザー確認 2026-10-26）
            $this->dbh->exec("CREATE TABLE t_authority_manage (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                authority_type TEXT NOT NULL UNIQUE,
                note TEXT,
                level INTEGER DEFAULT 0,
                applicate INTEGER DEFAULT 1,
                registed_date TEXT NOT NULL,
                updated_date TEXT NOT NULL
            )");
            $this->dbh->exec("CREATE TABLE t_user_authority_manage (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                authority_id INTEGER NOT NULL,
                account_type INTEGER NOT NULL,
                account_id INTEGER NOT NULL,
                applicate INTEGER DEFAULT NULL,
                registed_date TEXT NOT NULL,
                updated_date TEXT NOT NULL,
                UNIQUE(authority_id, account_type, account_id)
            )");

            // 複数機能が相乗りする汎用キー・バリュー設定テーブル。
            // 客先実物のDDLをSQLite向けに変換（COLLATE/ENGINE/COMMENT等のMySQL固有構文は落とす）。
            // 詳細はdocs/AMFPHP連携_差分除外リスト.md参照
            $this->dbh->exec("CREATE TABLE _properties (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category_key TEXT NOT NULL,
                category_id INTEGER NOT NULL,
                value1_1 TEXT NOT NULL,
                value1_2 TEXT, value1_3 TEXT, value1_4 TEXT, value1_5 TEXT,
                update_date TEXT,
                valid_fg INTEGER DEFAULT 1,
                del_fg INTEGER DEFAULT 0,
                UNIQUE(category_key, category_id)
            )");

            // [モック固有] 一覧APIは0件を「取得失敗」(503)扱いにするため、初回だけデモ用データを入れる。
            // 内容はserver/src/db.tsの旧SQLiteデモのseedと同じ。パスワードは平文を保存しない（SHA-1）
            $now = date('Y-m-d H:i:s');
            $seed = $this->dbh->prepare("INSERT INTO t_inet_user_auth
                (username, password, comment, number, submission_date, regist_date,
                 company_cd, company_name, store_cd, store_name,
                 company_store_cd, company_store_branch_num, non_sync, delfg, reg_date, upd_date)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)");
            $rows = array(
                array('dealer001', 'pw-001', '東日本エリア', 1001, '2024-04-01', '2024-04-05', 'C01', '北日本販売', 'S001', '札幌中央店', 'CS01', '01', 0),
                array('dealer002', 'pw-002', null, 1002, '2024-05-10', '2024-05-12', 'C02', '東日本販売', 'S002', '仙台駅前店', 'CS02', '03', 1),
                array('admin-honsha', 'pw-adm', '本社管理', 9001, null, '2023-01-01', 'C00', '本社', null, null, null, null, 0),
            );
            foreach ($rows as $row) {
                $row[1] = sha1($row[1]);
                $row[] = $now;
                $row[] = $now;
                $seed->execute($row);
            }

            // 権限マスタ（管理対象の2種類。実物にはほかの権限行もあるが、このツールは触らない）
            $authSeed = $this->dbh->prepare("INSERT INTO t_authority_manage
                (authority_type, note, level, applicate, registed_date, updated_date) VALUES (?, ?, 0, 1, ?, ?)");
            $authSeed->execute(array('ALL_MANUAL', '電子マニュアル全閲覧', $now, $now));
            $authSeed->execute(array('HTML_BROWSING', 'HTML版のみ閲覧', $now, $now));
            // dealer001(id=1)にALL_MANUAL、dealer002(id=2)に外したHTML_BROWSING(applicate=0)
            $userAuthSeed = $this->dbh->prepare("INSERT INTO t_user_authority_manage
                (authority_id, account_type, account_id, applicate, registed_date, updated_date) VALUES (?, 0, ?, ?, ?, ?)");
            $userAuthSeed->execute(array(1, 1, 1, $now, $now));
            $userAuthSeed->execute(array(2, 2, 0, $now, $now));

            // DIAG用テーブルのデモ用データ（通常にもいる人と、DIAG用にしかいない人を混ぜる）
            $seedDiag = $this->dbh->prepare("INSERT INTO t_inet_user_auth_ds3
                (username, password, comment, number, submission_date, regist_date,
                 company_cd, company_name, store_cd, store_name,
                 company_store_cd, company_store_branch_num, non_sync, delfg, reg_date, upd_date)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $diagRows = array(
                array('dealer001', 'pw-001', '通常にも登録あり', 1001, '2024-04-01', '2024-04-05', 'C01', '北日本販売', 'S001', '札幌中央店', 'CS01', '01', 0, 0),
                array('diag-only01', 'pw-d01', 'DIAGのみの契約', 2001, '2024-06-01', '2024-06-03', 'C03', '西日本販売', 'S010', '大阪南店', 'CS03', '02', 0, 0),
                array('diag-old02', 'pw-d02', null, 2002, '2023-02-01', '2023-02-02', 'C03', '西日本販売', 'S011', '神戸店', 'CS03', '04', 0, 1),
            );
            foreach ($diagRows as $row) {
                $row[1] = sha1($row[1]);
                $row[] = $now;
                $row[] = $now;
                $seedDiag->execute($row);
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
