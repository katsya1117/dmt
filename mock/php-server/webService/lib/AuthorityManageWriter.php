<?php
// t_user_authority_manage（権限）への同期を担う共通部品。
// TInetUserAuthWriterと同じ位置づけ：ログイン確認・DB接続は持たず、呼び出し側が
// 用意した$dbをそのまま使う（DbManagerTInetUserAuth / DbManagerAccountAuthImport /
// DbManagerAuthorityManageの3者から直接呼ばれる。2026-11-12 DbManagerAccountAuthImport
// から切り出し）。
//
// 権限は ALL_MANUAL / HTML_BROWSING の2種類だけを扱い、三者択一（なし／どちらか一方）に
// 揃える。それ以外の権限行には一切触れない。外すときは行を消さず applicate = 0 にする
// （UNIQUE KEY (authority_id, account_type, account_id) があるため、再付与は行の再利用）。
// account_type は通常/DIAGを区別する列ではない（ユーザー確認 2026-10-21）。旧PHPが
// 電子マニュアルアカウントの権限行に使っていた 0 を固定で使う。
class AuthorityManageWriter
{
    const MANAGED_AUTHORITIES = array('ALL_MANUAL', 'HTML_BROWSING');
    const ACCOUNT_TYPE = 0;

    // authority_type => id。2種類とも見つからなければnull
    public static function loadAuthorityIds($db)
    {
        $rows = $db->query("select id, authority_type from t_authority_manage where authority_type in ('ALL_MANUAL', 'HTML_BROWSING')");
        if (!is_array($rows)) return null;
        $ids = array();
        foreach ($rows as $row) $ids[$row['authority_type']] = (int) $row['id'];
        foreach (self::MANAGED_AUTHORITIES as $type) {
            if (!isset($ids[$type])) return null;
        }
        return $ids;
    }

    // 管理対象の2種類を、desired（'ALL_MANUAL'|'HTML_BROWSING'|null）に揃える。
    // 戻り値：成功ならnull、失敗ならエラーメッセージ
    public static function sync($db, $accountId, $desired, $authorityIds, $now)
    {
        foreach (self::MANAGED_AUTHORITIES as $type) {
            $authorityId = $authorityIds[$type];
            $existing = $db->query(
                "select id, applicate from t_user_authority_manage where authority_id = ? and account_type = ? and account_id = ?",
                array($authorityId, self::ACCOUNT_TYPE, $accountId)
            );
            if (!is_array($existing)) return $db->errMsg ?: 'DBの読み取りに失敗しました';
            $row = count($existing) > 0 ? $existing[0] : null;

            if ($type === $desired) {
                if ($row === null) {
                    $ret = $db->execute(
                        "insert into t_user_authority_manage (authority_id, account_type, account_id, applicate, registed_date, updated_date) values (?, ?, ?, 1, ?, ?)",
                        array($authorityId, self::ACCOUNT_TYPE, $accountId, $now, $now)
                    );
                } elseif ((int) $row['applicate'] !== 1) {
                    $ret = $db->execute("update t_user_authority_manage set applicate = 1, updated_date = ? where id = ?", array($now, $row['id']));
                } else {
                    $ret = true;
                }
            } else {
                if ($row !== null && (int) $row['applicate'] === 1) {
                    $ret = $db->execute("update t_user_authority_manage set applicate = 0, updated_date = ? where id = ?", array($now, $row['id']));
                } else {
                    $ret = true;
                }
            }
            if (!$ret) return $db->errMsg;
        }
        return null;
    }

    // 通常アカウントに付いている管理対象の権限一覧。applicate=0（外した行）も含めて返す
    // （Express側が「今どれが有効か」を判断する）。DbManagerAuthorityManage.loadから使う
    public static function loadAll($db)
    {
        return $db->query(
            "select u.account_id as account_id, a.authority_type as authority_type, u.applicate as applicate
               from t_user_authority_manage u
               join t_authority_manage a on a.id = u.authority_id
              where u.account_type = ? and a.authority_type in ('ALL_MANUAL', 'HTML_BROWSING')
              order by u.account_id",
            array(self::ACCOUNT_TYPE)
        );
    }
}
