<?php
// アカウント認証系テーブル（通常・DIAG用は同じ構造）への1レコード分のINSERT/UPDATEを
// 担う共通部品。TInetUserAuthBase（load/update）と、Excel取り込み適用
// （DbManagerAccountAuthImport）の両方から使う。
//
// $infoはgateway.phpがjson_decode()をtrue無しで呼ぶためstdClassオブジェクト
// （isset($info->...)/property_exists($info, ...)でアクセスする。2026-10-09）。
// 物理DELETEは意図的にサポートしない（客先DBで物理削除が不調のため論理削除のみ）。
class TInetUserAuthWriter
{
    // 戻り値：
    //   skipped=true  … updatemarkがINSERT/UPDATE以外のため何もしなかった
    //   ok            … 書き込み成功か（DBConnection::execute()の結果）
    //   id            … INSERTなら採番されたid、UPDATEなら対象のid
    public static function write($db, $table, $info, $now)
    {
        $updatemark = isset($info->updatemark) ? $info->updatemark : null;

        if ($updatemark === 'INSERT') {
            // 本物と同じく、SQL文字列＋プレースホルダの値を$db->execute()に渡す形。
            // DBConnection側がprepare/bindValue/executeの面倒を見てくれる
            $ret = $db->execute(
                "insert into $table
                    (username, password, comment, number, submission_date, regist_date,
                     company_cd, company_name, store_cd, store_name,
                     company_store_cd, company_store_branch_num, non_sync, delfg, reg_date, upd_date)
                    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                array(
                    $info->username, $info->password,
                    isset($info->comment) ? $info->comment : null,
                    isset($info->number) ? $info->number : null,
                    isset($info->submission_date) ? $info->submission_date : null,
                    isset($info->regist_date) ? $info->regist_date : null,
                    isset($info->company_cd) ? $info->company_cd : null,
                    isset($info->company_name) ? $info->company_name : null,
                    isset($info->store_cd) ? $info->store_cd : null,
                    isset($info->store_name) ? $info->store_name : null,
                    isset($info->company_store_cd) ? $info->company_store_cd : null,
                    isset($info->company_store_branch_num) ? $info->company_store_branch_num : null,
                    !empty($info->non_sync) ? 1 : 0,
                    !empty($info->delfg) ? 1 : 0,
                    $now, $now, // reg_date, upd_date とも新規作成時刻
                )
            );
            return array('skipped' => false, 'ok' => $ret, 'id' => $ret ? $db->lastInsertIdIntVal() : null);
        }

        if ($updatemark === 'UPDATE') {
            // 【本当の部分更新】このクラスは新アプリ専用の新規実装であり旧FLEXアプリと
            // 共有していないため、「全カラム上書き固定」の作法を踏襲する制約は無い
            // （DbManagerProperties.phpと同じ理由・同じ方式）。
            // $infoに含まれる列だけをSET句に組み込む（updatemark/idは除く）。
            // bool系(non_sync/delfg)だけ 1/0 に変換する
            $boolColumns = array('non_sync', 'delfg');
            $updatableColumns = array('username', 'password', 'comment', 'number', 'submission_date', 'regist_date', 'company_cd', 'company_name', 'store_cd', 'store_name', 'company_store_cd', 'company_store_branch_num', 'non_sync', 'delfg');
            $setParts = array('upd_date = ?'); // upd_dateだけ常に更新。reg_date（作成日時）はUPDATEでは変えない
            $values = array($now);
            foreach ($updatableColumns as $col) {
                // $info->$col は「変数$colの値をプロパティ名として使う」書き方
                if (property_exists($info, $col)) {
                    $setParts[] = "$col = ?";
                    $values[] = in_array($col, $boolColumns) ? (!empty($info->$col) ? 1 : 0) : $info->$col;
                }
            }
            $values[] = $info->id;

            $ret = $db->execute(
                "update $table set " . implode(', ', $setParts) . " where id = ?",
                $values
            );
            return array('skipped' => false, 'ok' => $ret, 'id' => $info->id);
        }

        // 物理DELETEは意図的にサポートしない（updatemarkがINSERT/UPDATE以外の場合は
        // 何もせず次のレコードへ進む）
        return array('skipped' => true, 'ok' => true, 'id' => null);
    }
}
