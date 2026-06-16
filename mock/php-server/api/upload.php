<?php
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
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$katashiki = isset($_POST['katashiki']) ? trim($_POST['katashiki']) : '';
if ($katashiki === '') {
    http_response_code(400);
    echo json_encode(['error' => 'katashikiが指定されていません']);
    exit;
}

// 型式名にディレクトリトラバーサルが含まれないかチェック
if (strpos($katashiki, '..') !== false || strpos($katashiki, '/') !== false) {
    http_response_code(400);
    echo json_encode(['error' => '不正な型式名です']);
    exit;
}

$uploadDir = '/var/www/html/uploads/' . $katashiki . '/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

$uploaded = [];
$errors   = [];

if (!empty($_FILES['files'])) {
    $files = $_FILES['files'];

    // $_FILES['files'] の配列を [{name, tmp_name, error}] の形に正規化
    $count = is_array($files['name']) ? count($files['name']) : 1;
    for ($i = 0; $i < $count; $i++) {
        $name    = is_array($files['name'])     ? $files['name'][$i]     : $files['name'];
        $tmpName = is_array($files['tmp_name']) ? $files['tmp_name'][$i] : $files['tmp_name'];
        $error   = is_array($files['error'])    ? $files['error'][$i]    : $files['error'];

        if ($error !== UPLOAD_ERR_OK) {
            $errors[] = $name . ': upload error ' . $error;
            continue;
        }

        $dest = $uploadDir . basename($name);
        if (move_uploaded_file($tmpName, $dest)) {
            $uploaded[] = $name;
        } else {
            $errors[] = $name . ': 保存失敗';
        }
    }
}

$status = count($errors) === 0 ? 'ok' : 'partial';
http_response_code(count($uploaded) > 0 ? 200 : 400);
echo json_encode([
    'status'   => $status,
    'katashiki' => $katashiki,
    'uploaded' => $uploaded,
    'errors'   => $errors,
]);
