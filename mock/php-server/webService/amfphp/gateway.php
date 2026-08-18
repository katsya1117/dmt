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

$body = json_decode(file_get_contents('php://input'), true);
$serviceName = is_array($body) && isset($body['serviceName']) ? $body['serviceName'] : '';
$methodName = is_array($body) && isset($body['methodName']) ? $body['methodName'] : '';
$parameters = is_array($body) && isset($body['parameters']) ? $body['parameters'] : [];

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

$service = new $serviceName();
echo json_encode(call_user_func([$service, $methodName], $parameters));
