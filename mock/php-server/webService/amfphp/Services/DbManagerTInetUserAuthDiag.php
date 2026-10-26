<?php
require_once __DIR__ . '/../../lib/TInetUserAuthBase.php';

// DIAG用アカウントのアカウント認証テーブル。物理テーブル名は既存DBの名前のまま（t_inet_user_authと同じ構造）
// load/updateの実装・引数・戻り値は lib/TInetUserAuthBase.php 参照
class DbManagerTInetUserAuthDiag extends TInetUserAuthBase
{
    protected $table = 't_inet_user_auth_ds3';
}
