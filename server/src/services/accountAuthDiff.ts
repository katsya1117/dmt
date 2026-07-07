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
  deleted: { username: string }[]
  restored: { username: string }[]
  unchangedCount: number
}

// AccountAuthInput の項目名（比較対象）
const INPUT_FIELDS: (keyof AccountAuthInput)[] = [
  'username', 'password', 'comment', 'number', 'submission_date', 'regist_date',
  'company_cd', 'company_name', 'company_store_cd', 'company_store_branch_num',
  'non_sync', 'store_cd', 'store_name', 'delfg',
]

// 認証に関わる（事故ると客がログインできなくなる）項目。UIで強調する
export const AUTH_CRITICAL_FIELDS = ['username', 'password', 'delfg']

export function computeImportDiff(records: AccountAuthInput[], current: AccountAuth[]): ImportDiff {
  const map = new Map<string, AccountAuth>()
  for (const c of current) map.set(c.username, c)

  const diff: ImportDiff = { added: [], changed: [], deleted: [], restored: [], unchangedCount: 0 }

  for (const r of records) {
    const cur = map.get(r.username)
    if (!cur) {
      diff.added.push(r)
      continue
    }
    // 削除／リストアは delfg の遷移で判定
    if (r.delfg && !cur.delfg) {
      diff.deleted.push({ username: r.username })
      continue
    }
    if (!r.delfg && cur.delfg) {
      diff.restored.push({ username: r.username })
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

  return diff
}

// 適用前検証：壊れた行・ファイル内重複・必須欠けを弾く（安全ルール#5）
export function validateImportRecords(records: AccountAuthInput[]): string[] {
  const errors: string[] = []
  const seen = new Set<string>()
  records.forEach((r, i) => {
    if (!r.username) errors.push(`${i + 1}行目：usernameが空です`)
    if (!r.password) errors.push(`${i + 1}行目：passwordが空です`)
    if (r.username) {
      if (seen.has(r.username)) errors.push(`ファイル内でusernameが重複しています: ${r.username}`)
      seen.add(r.username)
    }
  })
  return errors
}
