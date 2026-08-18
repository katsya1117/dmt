<?php
// ============================================================
// これは docs/legacy-amfphp/webService/config.real.php
// （客先の実際の通信境界＝DB接続情報・ネットワーク構成を含むため
// .gitignore対象・非公開）の代わりにコミットする、公開用の config.php です。
//
// 【方針】config.real.phpと「同じ構造・同じ条件分岐ロジック」をそのまま保ち、
// 顧客名・実ドメイン・実IP・実パスワードなど「特定/悪用されうる値」だけを
// ダミー値に置き換えています（安易な省略はしていません）。
//
// 変更した箇所は以下の2種類だけです：
//   1. 値の置き換え：会社名/ドメイン/IP/パスワード（コメントに [DUMMY] と明記）
//   2. requireのパス指定方法（下記コメント参照。これだけは構造自体を変更）
// それ以外の条件分岐・定数の意味・コメントは config.real.php をそのまま維持しています。
// ============================================================

// 【要注意・唯一の構造的な差分】config.real.php は require_once 'lib/Log.php';
// のように、実行時のカレントディレクトリ(CWD)基準の相対パスでrequireしている
// （CWDに依存して壊れやすい書き方。config.real.php側のコメント参照）。
// このダミー版はどこから呼ばれても確実に動くよう、あえて __DIR__ 基準の
// 絶対パスでrequireしている
require_once __DIR__ . '/lib/Log.php';
require_once __DIR__ . '/lib/DBConnection.php';
//require_once 'AllowIp.php';

// 診断データの検証環境／テスト環境
$__SM_DEVELOP = true;
$__VENDOR_DEVELOP = true;


$server_db_version = 8; // server db version
$logPath = $__SM_DEVELOP ? "dsmDbManageTest/" : "dsmDbManage/";

define('LOG_FOLDER', "/var/log/web/");
define('LOG_PATH', $logPath);
define('LOG_FILE', "webLog.log");
define('EXPORT_LOG_FILE', "exportLog.log");

// 【IPアドレスについて】[DUMMY] RFC5737の文書用IPアドレス帯(192.0.2.0/24等)に
// 置き換えています。実際の値ではありません
define('SMWEB_GLLBIP', '192.0.2.1');  // [DUMMY] 商用ロードバランサ：グローバルIP（実際に使用するか不明）
define('SMWEB_LLBIP', '192.0.2.2');   // [DUMMY] 商用ロードバランサ：ローカルIP
define('SMWEB1_LIP', '192.0.2.3');    // [DUMMY] 商用Webサーバー：ローカルIP
define('SMWEB2_LIP', '192.0.2.4');    // [DUMMY] 商用Webサーバー：ローカルIP
define('SMDB_LIP', '192.0.2.5');      // [DUMMY] 商用DBサーバー：ローカルIP
define('SMLOGDB_LIP', '192.0.2.6');   // [DUMMY] 商用ログ用DBサーバー：ローカルIP
define('SMWEBT_GIP', '198.51.100.1'); // [DUMMY] テスト環境Webサーバー：グローバルIP
define('SMWEBT_LIP', '192.0.2.7');    // [DUMMY] テスト環境Webサーバー：ローカルIP
define('SMDBT_LIP', '192.0.2.8');     // [DUMMY] テスト環境DBサーバー：ローカルIP

// 【ドメインについて】[DUMMY] 実際の客先ドメインではなく、架空のドメインに置き換えています
define('SMLOG_DOMAIN', 'https://service-info-log.example-customer.example/');
define('SMLOG_GIP', '198.51.100.2'); // [DUMMY] 利用ログWebサーバー：グローバルIP
define('SMLOG_LIP', '192.0.2.9');    // [DUMMY] 利用ログWebサーバー：ローカルIP

define('DSLOG_GIP', '198.51.100.3'); // [DUMMY] 故障診断サーバー：グローバルIP
define('DSLOG_LIP', '192.0.2.10');   // [DUMMY] 故障診断サーバー：ローカルIP

// VENDOR社内（開発ベンダー社内環境と思われる。プライベートIPのため実害は小さいが
// 内部ネットワーク構成情報ではある。[DUMMY] 念のためRFC5737の文書用IPに置き換え）
define('VENDOR_SMWEBT_LIP', '192.0.2.114'); // [DUMMY] VENDORテスト環境Webサーバー：ローカルIP
define('VENDOR_SMDBT_LIP', '192.0.2.114');  // [DUMMY] VENDORテスト環境DBサーバー：ローカルIP
define('VENDOR_SMLOG_LIP', '192.0.2.114');  // [DUMMY] VENDOR利用ログWebサーバー：ローカルIP
define('VENDOR_DSLOG_LIP', '192.0.2.127');  // [DUMMY] VENDOR故障診断サーバー：ローカルIP

//2024/03/11 切り離し: require_once 'extentionConfig.php'; //2023/02/22

//2025/09/05 sm-p8
//define('LOG_DIR', APP_DIR . 'logs/');
//define('LOG_FILE_SQL', LOG_DIR . 'webapp.log');

// ============================================================
// データベース接続情報定義
//
// 環境による相違を吸収
// DEFINE DB_HOST  データベースサーバー
//        DB_USER  接続アカウント
//        DB_PASS  パスワード
//        DB_NAME  データベース名
//
// 2016/02/25 検証環境なので入口が同じなのでとりあえず同じにする
// （本来は商用とテスト環境でDBを分ける為に使用している）
// examplecorp_dmv_dbアカウント（[DUMMY] 実際のアカウント名・パスワードではない）
// ALTER USER 'examplecorp_dmv_db'@'%' IDENTIFIED BY '[DUMMY-PASSWORD]';
// FLUSH PRIVILEGES;
// ============================================================

if (array_key_exists('SERVER_ADDR', $_SERVER)) {
  switch ($_SERVER['SERVER_ADDR']) {
    case VENDOR_SMWEBT_LIP: // Abe社内開発環境
      define('DB_HOST', 'localhost');
      break;
    case SMWEBT_LIP: // TEST環境
    case SMLOG_LIP:  // SMLOG21環境
      define('DB_HOST', 'SMLOG21.example-serviceinfo.example'); // [DUMMY] ドメイン置き換え
      break;
    default:
      // 商用環境
      define('DB_HOST', 'SMDB21.example-serviceinfo.example'); // [DUMMY] ドメイン置き換え
      break;
  }
} else {
  //2025/10/24
  if ($__VENDOR_DEVELOP) {
    define('DB_HOST', 'localhost');
  } else {
    define('DB_HOST', SMLOGDB_LIP);
  }
}

// operation_logの場合（コメントアウトされた旧設定。現在は使われていない）
/*
define('DB_USER', 'userlog');
if ($server_db_version >= 8) {
  define('DB_PASS', '[DUMMY-PASSWORD]');
} else {
  define('DB_PASS', '[DUMMY-PASSWORD]');
}

if ($__VENDOR_DEVELOP) {
  define('DB_NAME', 'operation_log');
} else {
  if ($__SM_DEVELOP) {
    define('DB_NAME', 'operation_log_t'); // 検証環境DB
  } else {
    // テスト環境と商用環境
    define('DB_NAME', 'operation_log');
  }
}
*/

// examplecorp_dmv_dbの場合（[DUMMY] 元は実際の客先アカウント名。架空の名前に置き換え）
if ($__VENDOR_DEVELOP) {
  define('DB_USER', 'examplecorp_dmv_db');
  if ($server_db_version >= 8) {
    define('DB_PASS', '[DUMMY-PASSWORD]');
  } else {
    define('DB_PASS', '[DUMMY-PASSWORD]');
  }
  define('DB_NAME', 'test_examplecorp_dmv');
} else {
  if ($__SM_DEVELOP) {
    define('DB_USER', 'root');
    define('DB_PASS', '[DUMMY-PASSWORD]');
    define('DB_NAME', 'test_examplecorp_dmv'); // 開発用データベース
  } else {
    // テスト環境と商用環境
    define('DB_USER', 'examplecorp_dmv_db');
    define('DB_PASS', '[DUMMY-PASSWORD]');
    define('DB_NAME', 'examplecorp_dmv_db');
  }
}

// ============================================================
// 接続元IP特定
//
// DEFINE REMOTE_ADDR      接続元IP（REMOTE_ADDRに設定する）
//        X_FORWARDED_FOR  リクエストヘッダ内のX-Forwarded-Forに設定されたIP
//        RP_CLIENTIP      リクエストヘッダ内のRp-clientipに設定されたIP
// ============================================================
//
// 2016/03/28 header情報を見て、接続IPを取得する
// リバースプロキシー経由の環境：Rp-clientip情報から取得
// VLB経由（Rp-clientipが無い場合）：X-Forwarded-ForからIP取得
// VFW直接：request headerではなく、$_SERVER['REMOTE_ADDR']から取得

if (function_exists("apache_request_headers")) {
  $headers = apache_request_headers();

  // Rp-clientipがリクエストヘッダに存在した場合はリバースプロキシー経由での接続元IP取得
  if (array_key_exists('Rp-clientip', $headers)) {
    define('RP_CLIENTIP', $headers['Rp-clientip']);
    define('REMOTE_ADDR', RP_CLIENTIP); // 接続元IPをRp-clientipで確定させる

    // X_FORWARDED_FOR情報を取得する
    if (array_key_exists('X-Forwarded-For', $headers)) {
      define('X_FORWARDED_FOR', $headers['X-Forwarded-For']);
    } else {
      define('X_FORWARDED_FOR', '');
    }
  } elseif (array_key_exists('X-Forwarded-For', $headers)) {
    // リクエストヘッダにRp-clientipは存在せず、X-Forwarded-Forに存在する場合は
    // X-Forwarded-Forで接続IPを特定する。
    // ※基本はイントラネット経由（しかし、検証機の場合はリバプロ経由でなければ
    //   インターネット経由も）
    // 2016/09/16 ：X-Forwarded-Forがunknownを設定してくる対応
    // 本件の場合、GIP指定でも、X-Forwarded-Forが以下のように不明な
    // 情報が書き込まれている
    //   "X-Forwarded-For": "unknown, 128.139.58.52"
    // その為、X-Forwarded-Forにunknownが含まれていないか検証してから判断する。
    // unknownが含まれている場合はREMOTE_ADDRを使用する
    if (strpos($headers['X-Forwarded-For'], 'unknown') === false) {
      define('X_FORWARDED_FOR', $headers['X-Forwarded-For']);
      define('RP_CLIENTIP', '');
      define('REMOTE_ADDR', X_FORWARDED_FOR); // 接続元IPをX-Forwarded-Forで確定させる
    } else {
      define('X_FORWARDED_FOR', '');
      define('RP_CLIENTIP', '');
      if (array_key_exists('REMOTE_ADDR', $_SERVER)) {
        define('REMOTE_ADDR', $_SERVER['REMOTE_ADDR']); // 接続元IPをREMOTE_ADDRで確定させる
      } else {
        define('REMOTE_ADDR', '');
      }
    }
  } else {
    // リクエストヘッダから接続元を取得できない場合はREMOTE_ADDRから取得（テスト環境）
    define('X_FORWARDED_FOR', '');
    define('RP_CLIENTIP', '');
    if (array_key_exists('REMOTE_ADDR', $_SERVER)) {
      define('REMOTE_ADDR', $_SERVER['REMOTE_ADDR']); // 接続元IPをREMOTE_ADDRで確定させる
    } else {
      define('REMOTE_ADDR', '');
    }
  }
} else {
  define('X_FORWARDED_FOR', '');
  define('RP_CLIENTIP', '');
  if (array_key_exists('REMOTE_ADDR', $_SERVER)) {
    define('REMOTE_ADDR', $_SERVER['REMOTE_ADDR']); // 接続元IPをREMOTE_ADDRで確定させる
  } else {
    define('REMOTE_ADDR', '');
  }
}

Log::OUT('****************************************************************');

// ============================================================
// インターネット／イントラネット判定
//
// 一部、他の環境依存の定義を含む
// DEFINE SERVER_TYPE                ネットワークアクセス先サーバー種別
//                                    9=イントラネット / 9≠インターネット
//        DS3_UPLOAD_SERVER_DIRECT   診断サーバーアップロード先ホスト（直接）
//        DS3_UPLOAD_SERVER_RPROXY   診断サーバーアップロード先ホスト（Reverse Proxy経由）
//        PARTS_CATALOG_ACCESS_CHECK パーツカタログサイトのアクセス判定用URL
//        USER_LOG_SERVER            利用ログ収集サーバーのアクセスURL
//        INNER_USER_LOG_SERVER      電子マニュアルサーバーからの利用ログ収集サーバーのアクセスURL
// ============================================================

//other 9 : internet  9: intranet
//define('SERVER_TYPE', 1)
//define('SERVER_TYPE', 9)

if (array_key_exists('SERVER_NAME', $_SERVER)) {
  //2016/03/01 新基盤検証サーバー対応
  // 外向けvFWがSERVER_NAMEに設定される場合はインターネット接続とみなす
  // 環境変数のIPで判定（可能かまだ未確認）
  //other 9 : internet  9: intranet
  //Log::OUT('config.php SERVER_NAME:' . $_SERVER["SERVER_NAME"]);
  switch ($_SERVER["SERVER_NAME"]) {
    case VENDOR_SMWEBT_LIP: // Abe社内開発環境
      define('SERVER_TYPE', 1); // インターネットを設定
      //define('SERVER_TYPE', 0); // 検証用
      break;

    //case "153.153.8.70": // テスト環境：Internet接続時のSERVER_NAMEで判断
    case SMWEBT_GIP:              // 2022移行：テスト環境：Internet接続時のSERVER_NAMEで判断
    case SMWEB_GLLBIP:            // 2022移行：商用LB GIP接続環境：Internet接続時のSERVER_NAMEで判断
    case "service-t-info.example-customer.example": // [DUMMY] 商用環境：Internet接続時のSERVER_NAMEで判断
    case "service-info.example-customer.example":   // [DUMMY] 商用環境：Internet接続時のSERVER_NAMEで判断
    case "smanual":                       // 商用環境：Internet接続時のSERVER_NAMEで判断
      // 実際にSERVER_NAMEで判定可能か実機での検証が必要
      if (REMOTE_ADDR == "203.0.113.1" || REMOTE_ADDR == "203.0.113.2") { // [DUMMY]
        //define('SERVER_TYPE', 9); // VENDOR検証用
        define('SERVER_TYPE', 1); // VENDOR検証用
      } else {
        define('SERVER_TYPE', 1); // インターネットを設定
        // 利用ログ収集サーバーへの接続はGIPかドメイン指定は接続時がGIPかドメインかで判断する
        if (
          $USER_LOG_NO_DOMAIN &&
          (($_SERVER["SERVER_NAME"] == SMWEBT_GIP) ||
            ($_SERVER["SERVER_NAME"] == SMWEB_GLLBIP))
        ) {
          //define('USER_LOG_SERVER', 'http://' . SMLOG_GIP); // 利用ログ収集サーバーURL
          if ($__SERVER_MIGRATION) { // GIP指定
            define('USER_LOG_SERVER', 'http://' . SMLOG_GIP);
          } else {
            define('USER_LOG_SERVER', SMLOG_DOMAIN); // リバプロ経由URL
          }
        } else {
          define('USER_LOG_SERVER', SMLOG_DOMAIN); // ドメイン指定URL
        }
        define('INNER_USER_LOG_SERVER', 'http://' . SMLOG_LIP); // 利用ログサーバーのローカルアクセス
      }
      break;

    default:
      define('SERVER_TYPE', 9); // イントラネットを設定
      // 2018/07/04 検証用として利用ログサーバー経由でアクセスした場合の挙動
      // 利用ログサーバーのローカルIPの判定は環境変数を直接参照する
      if ($_SERVER['REMOTE_ADDR'] != SMLOG_LIP) {
        define('USER_LOG_SERVER', 'http://' . SMLOG_LIP); // 利用ログ収集サーバーURL（ローカルアクセス）
        define('INNER_USER_LOG_SERVER', USER_LOG_SERVER); // 利用ログサーバーのローカルアクセス
      } else {
        // 2018/07/04 検証用として利用ログサーバー経由でアクセスした場合の挙動
        // 2022移行
        if (RP_CLIENTIP == '') {
          // GIP指定による利用ログ経由で故障診断データサーバーアクセス
          // 2024/03/11 常にドメイン指定とする
          define('USER_LOG_SERVER', SMLOG_DOMAIN);
        } else {
          // ドメイン指定による利用ログ経由で故障診断データサーバーアクセス
          define('USER_LOG_SERVER', SMLOG_DOMAIN);
        }
        define('INNER_USER_LOG_SERVER', 'http://' . SMLOG_LIP); // 利用ログサーバーのローカルアクセス
      }
  }
} else {
  define('SERVER_TYPE', 1);
  define('USER_LOG_SERVER', SMLOG_DOMAIN);
}
