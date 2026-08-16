<?php
// ↑ このタグから下がPHPコードとして実行される（HTMLに埋め込める言語なので、
// 「PHPコードの開始」を示す目印が要る）

/**
 * This file is part of amfPHP
 *
 * LICENSE
 *
 * This source file is subject to the license that is bundled
 * with this package in the file license.txt.
 */

/*
 * includes
 * @package Amfphp
 */
// "//" で始まる行はコメントアウト（実行されない）。バージョンアップ時に
// 別の書き方を試した名残がそのまま残っている
//require_once dirname(__FILE__) . '/ClassLoader.php';
//require_once dirname(__FILE__) . '/../../../../libs/amfphpForPhp8/Amfphp/ClassLoader.php';

// 【require_once とは】他のPHPファイルを読み込む命令。JSの import に近いが、
// 「クラス名を指定して読み込む」のではなく「ファイルパスをそのまま指定する」
// 素朴な仕組み（PHPには元々オートロードの仕組みがなく、こうやって手動で
// 依存ファイルを読み込むのが伝統的なやり方）。once が付くと同じファイルを
// 二重に読み込まない（多重定義エラーを防ぐ）
//
// 【__FILE__ / dirname() とは】__FILE__ は「このファイル自身の絶対パス」を
// 表すマジック定数（JSでいう import.meta.url に近い）。dirname() はパスから
// ファイル名を除いた「親ディレクトリのパス」を取り出す関数。
// なので dirname(__FILE__) . '/../../../../libs/...' は「このファイルから見て
// 4つ上の階層にある libs フォルダ」を指す相対パスの組み立て
require_once dirname(__FILE__) . '/../../../../libs/amfphpForPhp8/Amfphp/ClassLoader.php';

// 【new とは】JS/TSと同じ、クラスからインスタンス（実体）を作る演算子。
// Amfphp_Core_Config は、直前でrequireしたamfPHP本体ライブラリが提供する
// 設定用クラス
$config = new Amfphp_Core_Config();
//$config->serviceFolders = array(dirname(__FILE__) . '/../Services/');
//$config->serviceFolders = array(dirname(__FILE__) . '/services/');
// 【array(...) とは】PHPの配列を作る書き方（今どきは [...] とも書けるが、
// この古いコードは array() 表記で統一されている）。ここでは要素1個の配列
// （サービスクラスを探すフォルダのリスト）を作って設定している
$config->serviceFolders = array(dirname(__FILE__) . '/Services/');

//$voFolders = array(dirname(__FILE__) . '/../Vo/');
//$voFolders = array(dirname(__FILE__) . '/services/vo/');
//$config->pluginsConfig['AmfphpVoConverter'] = array('voFolders' => $voFolders);

/*
 * main entry point (gateway) for service calls. instanciates the gateway class and uses it
 * to handle the call.
 *
 * @package Amfphp
 * @author Ariel Sommeria-klein
 */
// amfPHP本体のファクトリ関数に設定を渡し、「リクエストを受けてサービスを
// 呼び出す係」のオブジェクト（ゲートウェイ）を作る
$gateway = Amfphp_Core_HttpRequestGatewayFactory::createGateway($config);

//use this to change the current folder to the services folder. Be careful of the case.
//This was done in 1.9 and can be used to support relative includes, and should be used
//when upgrading from 1.9 to 2.0 if you use relative includes
//chdir(dirname(__FILE__) . '/../Services');

// 【このファイル全体の役割】ここまでの設定を元に、実際に来たHTTPリクエスト
// （index.htmlのfetchが送ってきたJSON）を解釈して、$config->serviceFoldersで
// 指定したフォルダの中から serviceName に一致するクラスの methodName に
// 一致するメソッドを、parameters を引数にして呼び出す。それが下の2行
$gateway->service(); // リクエストを受け取り、該当サービスのメソッドを実行する
$gateway->output();  // 実行結果をHTTPレスポンスとして返す（JSON化して出力）
