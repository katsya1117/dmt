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

export interface DeletedRow {
  username: string
  before: AccountAuth // 適用時にidで対象行を特定するため保持
  after: AccountAuthInput
}

export interface RestoredRow {
  username: string
  before: AccountAuth
  after: AccountAuthInput
}

// 既知のレガシー重複としてマークされているが、No.に対応するDB行が見つからず
// 変更を一切適用しなかった行（通常は空になるはず。データ不整合の兆候）。
// 【usernameでdedupしない】同じusernameで複数のNo.が未マッチになるケースが
// あり得るため、usernameだけを集約すると「どのNo.が問題か」が分からなくなる。
// No.が本来の一意なキーなので、行ごと（username+number）にそのまま持つ
export interface SkippedRow {
  username: string
  number: number | null
}

export interface ImportDiff {
  added: AccountAuthInput[]
  changed: ChangedRow[]
  deleted: DeletedRow[]
  restored: RestoredRow[]
  unchangedCount: number
  skippedDuplicateUsernames: SkippedRow[]
}

// ─────────────────────────────────────────────────────────────
// 客先の旧運用で、username重複のまま現役でエンドユーザーに使われている
// ことが判明している既知のレコード（No.で特定）。
//
// 【意図的にNo.のハードコードにしている】現在のDBを見て「username重複が
// あれば自動でレガシー扱い」という動的判定も考えられるが、それだと将来
// 何らかの理由で意図しない新しい重複が発生した場合もサイレントに見逃して
// しまう。No.を明示的に列挙する方式なら、本当に把握している既知の問題
// レコードだけを保護しつつ、それ以外の重複は今まで通り検知・拒否できる。
//
// 【重要】ここに載っているレコードも、Excel取り込みでusername重複の
// バリデーション対象外にするだけで、他カラム（備考・住所等）の変更は
// 通常通り検知・適用される。usernameが重複していてもNo.は一意という
// 前提のもと、DB行の照合はusernameではなくNo.で行う（下記computeImportDiff参照）。
//
// 更新方法：この配列に対象レコードのNo.を追加/削除するだけでよい
// （2026-07-13時点、実際のNo.は未確定 — 客先に確認の上で埋めること）
// ─────────────────────────────────────────────────────────────
const LEGACY_DUPLICATE_NUMBERS: readonly number[] = [
  // TODO: 客先から実際のNo.を確認して埋める
]

function isKnownLegacyDuplicate(record: Pick<AccountAuthInput, 'number'>): boolean {
  return record.number != null && LEGACY_DUPLICATE_NUMBERS.includes(record.number)
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
  const byUsername = new Map<string, AccountAuth>()
  const byNumber = new Map<number, AccountAuth>()
  for (const c of current) {
    byUsername.set(c.username, c)
    if (c.number != null) byNumber.set(c.number, c)
  }

  const diff: ImportDiff = { added: [], changed: [], deleted: [], restored: [], unchangedCount: 0, skippedDuplicateUsernames: [] }
  const skipped: SkippedRow[] = []

  for (const r of records) {
    const legacy = isKnownLegacyDuplicate(r)
    // 既知のレガシー重複：usernameでは行を一意特定できないため、代わりにNo.で照合する
    // （No.は一意という前提。見つからなければ安全側で変更せずスキップし警告に残す）
    const cur = legacy ? (r.number != null ? byNumber.get(r.number) : undefined) : byUsername.get(r.username)

    if (!cur) {
      if (legacy) {
        skipped.push({ username: r.username, number: r.number }) // No.が既存DBに見つからない＝データ不整合。触らず警告のみ
      } else {
        diff.added.push(r)
      }
      continue
    }
    // 削除／リストアは delfg の遷移で判定
    if (r.delfg && !cur.delfg) {
      diff.deleted.push({ username: r.username, before: cur, after: r })
      continue
    }
    if (!r.delfg && cur.delfg) {
      diff.restored.push({ username: r.username, before: cur, after: r })
      continue
    }
    // それ以外は項目の差分（レガシー重複行でも同様に検知・適用対象にする）
    const changedFields = INPUT_FIELDS.filter((f) => r[f] !== cur[f])
    if (changedFields.length > 0) {
      diff.changed.push({ username: r.username, before: cur, after: r, changedFields })
    } else {
      diff.unchangedCount++
    }
  }

  diff.skippedDuplicateUsernames = skipped
  return diff
}

// 適用前検証：壊れた行・ファイル内重複・必須欠けを弾く（安全ルール#5）
// 既知のレガシー重複（LEGACY_DUPLICATE_NUMBERS）は「ファイル内でusernameが重複」
// というチェックの対象外とする（No.で一意に区別できるため）。それ以外の新規の
// username重複は引き続き拒否する
export function validateImportRecords(records: AccountAuthInput[]): string[] {
  const errors: string[] = []
  const seen = new Set<string>()
  records.forEach((r, i) => {
    if (!r.username) errors.push(`${i + 1}行目：usernameが空です`)
    if (!r.password) errors.push(`${i + 1}行目：passwordが空です`)
    if (isKnownLegacyDuplicate(r)) return
    if (r.username) {
      if (seen.has(r.username)) errors.push(`ファイル内でusernameが重複しています（新規の重複登録は許可されません）: ${r.username}`)
      seen.add(r.username)
    }
  })
  return errors
}
