<?php
// AMFPHPのJSONプラグイン互換モック。
//
// 本物は docs/legacy-amfphp/webService/amfphp/gateway.php のように、AMFPHP本体
// ライブラリ（このリポジトリには無い）が {serviceName, methodName, parameters} を
// 受け取ってサービスクラスのメソッドを呼び出す。ここではそのライブラリを使わず、
// 同じ入出力契約だけを素朴なPHPで再現している（開発中にExpress側の実装・型・
// レスポンス整形を確認するためのスタブ。業務ロジックの正しさの保証はしない）。

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['code' => -1, 'errormsg' => 'Method not allowed']);
    exit;
}

// 第2引数を付けない（デフォルトfalse）ため、JSONオブジェクト{serviceName,...}は
// PHPのstdClassオブジェクトになる（本番側の方式に統一。2026-10-09）。
// $parameters自体はJSON配列由来なので、この設定に関わらず常にPHPの配列になる
// （オブジェクト/配列の違いはJSONオブジェクト{}にのみ関係し、JSON配列[]には関係しない）
$body = json_decode(file_get_contents('php://input'));
$serviceName = is_object($body) && isset($body->serviceName) ? $body->serviceName : '';
$methodName = is_object($body) && isset($body->methodName) ? $body->methodName : '';
$parameters = is_object($body) && isset($body->parameters) ? $body->parameters : [];
// call_user_func_arrayは配列を要求するため、万一parametersが配列でない
// 形で送られてきても落ちないよう安全策を取る
if (!is_array($parameters)) {
    $parameters = [];
}

// サービス名からファイルパスを組み立てる前にホワイトリスト形式で検証する
// （ディレクトリトラバーサル・任意ファイルインクルード対策）
if (!preg_match('/^[A-Za-z0-9_]+$/', $serviceName)) {
    http_response_code(400);
    echo json_encode(['code' => -1, 'errormsg' => "invalid serviceName: $serviceName"]);
    exit;
}

$serviceFile = __DIR__ . '/Services/' . $serviceName . '.php';
if (!file_exists($serviceFile)) {
    http_response_code(404);
    echo json_encode(['code' => -1, 'errormsg' => "unknown service: $serviceName"]);
    exit;
}
require_once $serviceFile;

if (!class_exists($serviceName) || !method_exists($serviceName, $methodName)) {
    http_response_code(404);
    echo json_encode(['code' => -1, 'errormsg' => "unknown method: $serviceName.$methodName"]);
    exit;
}

// call_user_func_array：$parametersの各要素を、サービスメソッドの個別の
// 引数として展開して渡す（call_user_funcは$parameters全体を1つの引数として
// 渡してしまうため、メソッド側で引数を分割して受け取れるようこちらを使う。
// 2026-10-16方針変更。詳細はdocs/AMFPHP連携.md参照）
$service = new $serviceName();
echo json_encode(call_user_func_array([$service, $methodName], $parameters));
