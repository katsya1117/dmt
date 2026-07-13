import type { AccountAuth, AccountAuthInput } from '../repositories/accountAuth'

// ─────────────────────────────────────────────────────────────
// Excel取り込みの差分計算（純粋関数・書き込みなし）。
// 「ファイルにある行だけ」判定する。ファイルに無い＝削除にはしない（安全）。
// 現状(current)は delfg=1 も含めた全件を渡すこと（リストア判定のため）。
// ─────────────────────────────────────────────────────────────

export interface ChangedRow {
  username: string
  before: AccountAuth
  after: AccountAuthInput
  changedFields: string[]
}

export interface ImportDiff {
  added: AccountAuthInput[]
  changed: ChangedRow[]
  deleted: AccountAuthInput[] // ファイル側の行そのもの（プレビュー表示用に全項目を持つ）
  restored: AccountAuthInput[]
  unchangedCount: number
  // 既存DBでusernameが重複しているレガシーデータ。Excel取り込みでは一切触らない
  // （どのDB行に対応するか一意に決められないため）。2026-07-13追記
  skippedDuplicateUsernames: string[]
}

// AccountAuthInput の項目名（比較対象）
const INPUT_FIELDS: (keyof AccountAuthInput)[] = [
  'username', 'password', 'comment', 'number', 'submission_date', 'regist_date',
  'company_cd', 'company_name', 'company_store_cd', 'company_store_branch_num',
  'non_sync', 'store_cd', 'store_name', 'delfg',
]

// 認証に関わる（事故ると客がログインできなくなる）項目。UIで強調する
export const AUTH_CRITICAL_FIELDS = ['username', 'password', 'delfg']

// 現在のDBでusernameが重複している（＝レガシーの重複登録）ものを特定する。
// 客先の旧運用では、usernameが重複していてもpasswordで区別されていた実績があり、
// これらの既存データは今も現役のためExcel取り込みでは絶対に触らない。
// 新規にusernameを重複させることは今後禁止するため、ここでの「重複」は
// あくまで現在のDBに既に2件以上存在するものだけを指す（新規の重複はここに含まれない）
function findLegacyDuplicatedUsernames(current: AccountAuth[]): Set<string> {
  const counts = new Map<string, number>()
  for (const c of current) counts.set(c.username, (counts.get(c.username) ?? 0) + 1)
  return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([u]) => u))
}

export function computeImportDiff(records: AccountAuthInput[], current: AccountAuth[]): ImportDiff {
  const legacyDuplicated = findLegacyDuplicatedUsernames(current)
  const map = new Map<string, AccountAuth>()
  for (const c of current) map.set(c.username, c) // 重複時は最後の1件のみ保持（該当usernameは下でスキップするため比較には使わない）

  const diff: ImportDiff = { added: [], changed: [], deleted: [], restored: [], unchangedCount: 0, skippedDuplicateUsernames: [] }
  const skipped = new Set<string>()

  for (const r of records) {
    if (legacyDuplicated.has(r.username)) {
      // 既存DBでusernameが重複しているレガシーデータ：追加/変更/削除/リストア
      // いずれの判定もせず完全にスキップする（どのDB行に対応するか一意に決められない）
      skipped.add(r.username)
      continue
    }
    const cur = map.get(r.username)
    if (!cur) {
      diff.added.push(r)
      continue
    }
    // 削除／リストアは delfg の遷移で判定
    if (r.delfg && !cur.delfg) {
      diff.deleted.push(r)
      continue
    }
    if (!r.delfg && cur.delfg) {
      diff.restored.push(r)
      continue
    }
    // それ以外は項目の差分
    const changedFields = INPUT_FIELDS.filter((f) => r[f] !== cur[f])
    if (changedFields.length > 0) {
      diff.changed.push({ username: r.username, before: cur, after: r, changedFields })
    } else {
      diff.unchangedCount++
    }
  }

  diff.skippedDuplicateUsernames = [...skipped]
  return diff
}

// 適用前検証：壊れた行・ファイル内重複・必須欠けを弾く（安全ルール#5）
// currentが必要な理由：ファイル内でusernameが重複していても、それが既存DBの
// レガシー重複と一致するなら許容する（computeImportDiff側で完全スキップされる）。
// 拒否するのは「今のDBにはまだ無いusername」を新規に重複させようとするケースのみ
export function validateImportRecords(records: AccountAuthInput[], current: AccountAuth[]): string[] {
  const errors: string[] = []
  const legacyDuplicated = findLegacyDuplicatedUsernames(current)
  const seen = new Set<string>()
  const fileDuplicates = new Set<string>()

  records.forEach((r, i) => {
    if (!r.username) errors.push(`${i + 1}行目：usernameが空です`)
    if (!r.password) errors.push(`${i + 1}行目：passwordが空です`)
    if (r.username) {
      if (seen.has(r.username)) fileDuplicates.add(r.username)
      seen.add(r.username)
    }
  })

  for (const u of fileDuplicates) {
    if (!legacyDuplicated.has(u)) {
      errors.push(`ファイル内でusernameが重複しています（新規の重複登録は許可されません）: ${u}`)
    }
  }

  return errors
}
