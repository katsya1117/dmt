<?php
require_once __DIR__ . '/../../lib/TInetUserAuthBase.php';

// 通常アカウントのアカウント認証テーブル（t_inet_user_auth）
// load/updateの実装・引数・戻り値は lib/TInetUserAuthBase.php 参照
class DbManagerTInetUserAuth extends TInetUserAuthBase
{
    protected $table = 't_inet_user_auth';
}
