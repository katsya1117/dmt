import { callAmfphpService } from "../services/amfphpClient";

// ─────────────────────────────────────────────────────────────
// Excel取り込みの比較前値置換ルール用リポジトリ。importExcludeList.tsと同じ
// 構造（_properties経由、DbManagerProperties）。詳細は
// docs/Excel取り込み_比較前値置換ルール.md参照。
// 【社内限定機能】将来の権限管理実装時、この管理UIは客先ロールには見せない
// こと（同ドキュメント参照）。
// - 物理DELETEはしない。削除は論理削除（del_fg=1）
// ─────────────────────────────────────────────────────────────

// 他機能と衝突しないよう十分に具体的な名前にしている（要確認：客先で本当に
// 衝突していないか未確認。docs/Excel取り込み_比較前値置換ルール.md参照）
const CATEGORY_KEY = "account_auth_import_value_normalize";

export type ImportValueNormalizeRule = {
  id: number;
  field: string;
  fromValue: string;
  toValue: string;
};

// AMFPHP(DbManagerProperties.load)がSELECTで返す生の行
type PhpRow = {
  id: number | string;
  category_id: number | string;
  value1_1: string | null;
  value1_2: string | null;
  value1_3: string | null;
  del_fg: number | string;
};

function toApi(row: PhpRow): ImportValueNormalizeRule {
  return {
    id: Number(row.id),
    field: row.value1_1 ?? "",
    fromValue: row.value1_2 ?? "",
    toValue: row.value1_3 ?? "",
  };
}

export async function listImportValueNormalizeRules(): Promise<
  ImportValueNormalizeRule[]
> {
  const rows = await callAmfphpService<PhpRow[]>("DbManagerProperties", "load", [
    CATEGORY_KEY,
  ]);
  return rows.map(toApi);
}

export async function addImportValueNormalizeRule(
  field: string,
  fromValue: string,
  toValue: string,
): Promise<void> {
  await callAmfphpService("DbManagerProperties", "update", [
    CATEGORY_KEY,
    [
      {
        updatemark: "INSERT",
        category_key: CATEGORY_KEY,
        value1_1: field,
        value1_2: fromValue,
        value1_3: toValue,
      },
    ],
  ]);
}

export async function removeImportValueNormalizeRule(id: number): Promise<void> {
  await callAmfphpService("DbManagerProperties", "update", [
    CATEGORY_KEY,
    [{ updatemark: "UPDATE", id, category_key: CATEGORY_KEY, del_fg: true }],
  ]);
}
