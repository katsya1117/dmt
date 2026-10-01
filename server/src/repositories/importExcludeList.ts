import { callAmfphpService } from "../services/amfphpClient";

// ─────────────────────────────────────────────────────────────
// Excel取り込みの差分除外Noリスト用リポジトリ。_properties（客先の汎用設定
// テーブル）をDbManagerProperties経由で読み書きする。詳細・category_key/
// category_idの意味づけはdocs/AMFPHP連携_差分除外リスト.md参照。
// - 物理DELETEはしない。削除は論理削除（del_fg=1）
// - DbManagerProperties.updateは本当の部分更新に対応しているため、削除は
//   対象行を読み直さず {id, del_fg: true} だけ送ればよい
// ─────────────────────────────────────────────────────────────

// 他機能と衝突しないよう十分に具体的な名前にしている（要確認：客先で本当に
// 衝突していないか未確認。docs/AMFPHP連携_差分除外リスト.md参照）
const CATEGORY_KEY = "account_auth_import_exclude_number";

export type ImportExcludeNumber = {
  id: number;
  number: number;
  comment: string | null;
};

// AMFPHP(DbManagerProperties.load)がSELECTで返す生の行
type PhpRow = {
  id: number | string;
  category_id: number | string;
  value1_1: string | null;
  value1_2: string | null;
  del_fg: number | string;
};

function toApi(row: PhpRow): ImportExcludeNumber {
  return {
    id: Number(row.id),
    number: Number(row.value1_1),
    comment: row.value1_2,
  };
}

export async function listImportExcludeNumbers(): Promise<ImportExcludeNumber[]> {
  const rows = await callAmfphpService<PhpRow[]>("DbManagerProperties", "load", [
    CATEGORY_KEY,
  ]);
  return rows.map(toApi);
}

export async function addImportExcludeNumber(
  number: number,
  comment: string | null,
): Promise<void> {
  await callAmfphpService("DbManagerProperties", "update", [
    CATEGORY_KEY,
    [
      {
        updatemark: "INSERT",
        category_key: CATEGORY_KEY,
        value1_1: String(number),
        value1_2: comment,
      },
    ],
  ]);
}

export async function removeImportExcludeNumber(id: number): Promise<void> {
  await callAmfphpService("DbManagerProperties", "update", [
    CATEGORY_KEY,
    [{ updatemark: "UPDATE", id, category_key: CATEGORY_KEY, del_fg: true }],
  ]);
}
