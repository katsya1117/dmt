import type { AccountAuth, AccountAuthInput } from '../repositories/accountAuth'
import { hashPassword } from '../utils/hashPassword'

// ─────────────────────────────────────────────────────────────
// Excel取り込みの差分計算（純粋関数・書き込みなし）。
// 「ファイルにある行だけ」判定する。ファイルに無い＝削除にはしない（安全）。
// 現状(current)は delfg=1 も含めた全件を渡すこと（リストア判定のため）。
// ─────────────────────────────────────────────────────────────

// line = Excelファイル内の行番号（1始まり）。プレビュー画面で検証エラーの
// 行を該当レコードにハイライトするために持たせている
export interface AddedRow {
  line: number
  record: AccountAuthInput
}

export interface ChangedRow {
  line: number
  username: string
  before: AccountAuth
  after: AccountAuthInput
  changedFields: string[]
}

export interface DeletedRow {
  line: number
  username: string
  before: AccountAuth // 適用時にidで対象行を特定するため保持
  after: AccountAuthInput
}

export interface RestoredRow {
  line: number
  username: string
  before: AccountAuth
  after: AccountAuthInput
}

export interface ValidationError {
  line: number
  message: string
}

export interface ImportDiff {
  added: AddedRow[]
  changed: ChangedRow[]
  deleted: DeletedRow[]
  restored: RestoredRow[]
  unchangedCount: number
  // ファイル内重複などの検証エラー（validateImportRecordsと同じ内容）。
  // プレビュー時点で気づけるように、差分計算自体は止めずここに載せて返す。
  // lineを持たせているのは、プレビュー画面で該当行をハイライトするため
  validationErrors: ValidationError[]
}

// AccountAuthInput の項目名（比較対象）。【commentは含めない】備考欄はExcelから
// 来るものではなく運用担当者がアプリ上で手動編集するものなので、Excel側の値と
// 差分検知・上書きの対象にしない（下記の自動追記コメント生成でのみcommentを触る）
const INPUT_FIELDS: (keyof AccountAuthInput)[] = [
  'username', 'password', 'number', 'submission_date', 'regist_date',
  'company_cd', 'company_name', 'company_store_cd', 'company_store_branch_num',
  'non_sync', 'store_cd', 'store_name', 'delfg',
]

// 認証に関わる（事故ると客がログインできなくなる）項目。UIで強調する
export const AUTH_CRITICAL_FIELDS = ['username', 'password', 'delfg']

// 変更内容を表す項目名（運用担当者が普段手入力している備考の文言に合わせる）
const FIELD_LABELS: Partial<Record<keyof AccountAuthInput, string>> = {
  username: 'ユーザー名',
  number: 'No.',
  submission_date: '申込日',
  regist_date: '登録日',
  company_cd: '販社CD',
  company_name: '販売会社',
  company_store_cd: '販売会社店舗CD',
  company_store_branch_num: '店舗CD枝番',
  non_sync: '診断データ対象外',
  store_cd: '販売店CD',
  store_name: '販売店名',
}

function todayStr(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`
}

function formatValue(v: string | number | boolean | null): string {
  if (v === null || v === '') return '（空）'
  if (typeof v === 'boolean') return v ? 'ON' : 'OFF'
  return String(v)
}

// 変更内容から「yyyy/mm/dd 項目名変更 旧値→新値、項目名変更 旧値→新値」を生成する。
// パスワードは値そのものを残さない（セキュリティ上、備考に平文/ハッシュを載せない）
function buildChangeComment(changedFields: (keyof AccountAuthInput)[], before: AccountAuth, after: AccountAuthInput): string | null {
  const parts = changedFields
    .filter((f) => f !== 'password')
    .map((f) => `${FIELD_LABELS[f] ?? f}変更 ${formatValue(before[f])}→${formatValue(after[f])}`)
  if (changedFields.includes('password')) parts.push('パスワード変更')
  if (parts.length === 0) return null
  return `${todayStr()} ${parts.join('、')}`
}

// 既存の備考の後ろにスペース区切りで追記する（上書きしない）
function appendComment(existing: string | null, addition: string): string {
  return existing && existing.trim() !== '' ? `${existing} ${addition}` : addition
}

export function computeImportDiff(records: AccountAuthInput[], current: AccountAuth[]): ImportDiff {
  const byUsername = new Map<string, AccountAuth>()
  const byNumber = new Map<number, AccountAuth>()
  for (const c of current) {
    byUsername.set(c.username, c)
    if (c.number != null) byNumber.set(c.number, c)
  }

  const diff: ImportDiff = {
    added: [], changed: [], deleted: [], restored: [], unchangedCount: 0,
    validationErrors: [],
  }

  records.forEach((r, i) => {
    const line = i + 1
    // 【No.を優先して照合する】usernameは削除後に別レコードで再利用できる
    // 仕様のため、DBに同じusernameの行が複数存在しうる（例：dealer099を削除
    // →別レコードで再びdealer099を使う）。usernameだけで照合すると
    // byUsernameが後勝ちで上書きされ、間違った方のDB行にマッチしてしまう
    // （実例：削除済みのはずの行が、生きている別レコードにマッチしてしまい
    // 誤って「削除」の差分として検出される）。No.は削除済み含む全レコードで
    // 一意という前提があるため、No.があればそちらを優先する
    // （2026-08-06、運用データでの不具合報告により修正）
    const cur = r.number != null ? (byNumber.get(r.number) ?? byUsername.get(r.username)) : byUsername.get(r.username)

    if (!cur) {
      // 新規追加はExcelのcomment列を使わず常に空で始める（備考は運用担当者が
      // アプリ上で手動で書くもので、Excel由来の値を持ち込まない）
      diff.added.push({ line, record: { ...r, comment: null } })
      return
    }
    // 削除／リストアは delfg の遷移で判定。備考に「yyyy/mm/dd 削除」「yyyy/mm/dd 再登録」を自動追記する
    if (r.delfg && !cur.delfg) {
      diff.deleted.push({ line, username: r.username, before: cur, after: { ...r, comment: appendComment(cur.comment, `${todayStr()} 削除`) } })
      return
    }
    if (!r.delfg && cur.delfg) {
      diff.restored.push({ line, username: r.username, before: cur, after: { ...r, comment: appendComment(cur.comment, `${todayStr()} 再登録`) } })
      return
    }
    // それ以外は項目の差分。
    // 【passwordだけ特別扱い】DBにはハッシュ、Excelには平文が入っているため、
    // 単純な文字列比較だと常に不一致になり「未変更でも変更扱い」になってしまう。
    // Excel側をハッシュ化してから比較することで、実際にパスワードが変わった
    // 場合だけを検知する
    const changedFields = INPUT_FIELDS.filter((f) => {
      if (f === 'password') return hashPassword(r.password) !== cur.password
      return r[f] !== cur[f]
    })
    if (changedFields.length > 0) {
      const changeText = buildChangeComment(changedFields, cur, r)
      const after: AccountAuthInput = { ...r, comment: changeText ? appendComment(cur.comment, changeText) : cur.comment }
      diff.changed.push({ line, username: r.username, before: cur, after, changedFields })
    } else {
      diff.unchangedCount++
    }
  })

  return diff
}

// 適用前検証：壊れた行・ファイル内重複・必須欠けを弾く（安全ルール#5）
// usernameにDB UNIQUE制約は無い（客先の旧運用で重複usernameが現役で存在する
// ため）ので、この関数がusername重複を拒否する唯一の層。No.も同様にDB制約が
// 無いため、拒否できるのはこの関数だけ
//
// 【No.とusernameで一意性チェックの範囲が異なる】
// - No.は「全レコード」（削除済み含む）で一意性を見る。一度使われたNo.を
//   削除後に別レコードへ再割り当てすると紛らわしいため、delfg=trueの行でも
//   チェック対象・記録対象にする（2026-07-31、ユーザー指摘で変更）
// - usernameは「生きている行（delfg=false）同士」でのみチェックする。客先の
//   運用要望：削除フラグを立てたレコードのusernameは「空き」として扱い、別
//   レコードで再割り当てしたい。よってdelfg=trueの行はusername重複チェック
//   の対象外（他の行のusernameとぶつかっていても無視する）。ただし、リストア
//   （delfg: true→false）によって「生きている行」同士が重複する場合は通常の
//   新規追加と同じ扱いで拒否する（呼び出し側は該当行をrecordsに含めて渡すことで
//   自然にこのチェックにかかる。特別扱いの分岐は用意しない）
//
// 【手動追加・手動更新（リストア含む）でも同じ関数を使う】Excel取り込みは
// 再アップロードされた全件を records に渡すため既存No./usernameも自然に
// 含まれるが、手動追加・更新は対象の1行だけしか持たない。
// existingNumbers（全レコード）/existingUsernames（自分以外の生きている
// レコード）を渡すことで、手動操作からの呼び出しでも「既存データとの重複」
// を同じロジックで検知できる（Excel取り込みとバリデーションが分岐しないようにするため）
export function validateImportRecords(
  records: AccountAuthInput[],
  existingNumbers: ReadonlySet<number> = new Set(),
  existingUsernames: ReadonlySet<string> = new Set(),
): ValidationError[] {
  const errors: ValidationError[] = []
  // 【行番号(No.)も記録する】usernameそのものが重複の原因なので、usernameだけを
  // エラーメッセージに出しても「ファイルの何行目とどこが重複しているか」が
  // 分からない。初出の行番号を記録し、重複検出時に両方の行番号を提示する
  const firstSeenLine = new Map<string, string>()
  const firstSeenNumberLine = new Map<number, string>()
  for (const n of existingNumbers) firstSeenNumberLine.set(n, '既存データ')
  for (const u of existingUsernames) firstSeenLine.set(u, '既存データ')
  records.forEach((r, i) => {
    const line = i + 1
    if (!r.username) errors.push({ line, message: `${line}行目：usernameが空です` })
    if (!r.password) errors.push({ line, message: `${line}行目：passwordが空です` })
    // No.は削除済み行も含めて常にチェックする（過去に使われたNo.の再利用を防ぐ）
    if (r.number != null) {
      const firstNumber = firstSeenNumberLine.get(r.number)
      if (firstNumber != null) {
        errors.push({ line, message: `${line}行目：No.が${firstNumber}と重複しています（No.は一意である必要があります）: ${r.number}` })
      } else {
        firstSeenNumberLine.set(r.number, `${line}行目`)
      }
    }
    // username重複チェックだけは削除済み行（delfg=true）を対象外にする
    // （空き番号扱いという業務ルールのため。No.とは扱いが異なる点に注意）
    if (r.delfg) return
    if (r.username) {
      const first = firstSeenLine.get(r.username)
      if (first != null) {
        errors.push({ line, message: `${line}行目：usernameが${first}と重複しています（新規の重複登録は許可されません）: ${r.username}` })
      } else {
        firstSeenLine.set(r.username, `${line}行目`)
      }
    }
  })
  return errors
}

// 手動追加・更新は常に1件だけの検証なので、Excel取り込み前提の「N行目：」
// という前置きが意味を成さない（「1行目：usernameが空です」等、存在しない
// 「行」の話をしているように見えてしまう）。手動操作の呼び出し元だけ、
// メッセージ先頭のこの前置きを取り除いて表示する。
// 【なぜこの1箇所を消すだけで済むか】手動呼び出しはrecordsが常に1件
// （line=1固定）で、existingNumbers/existingUsernamesは常に「既存データ」
// ラベルとして渡ってくるため、メッセージ本文中に他の行番号が登場することは
// ない（先頭の「1行目：」を除けば行番号への言及自体が無い）
export function formatManualValidationMessage(error: ValidationError): string {
  return error.message.replace(/^\d+行目：/, '')
}
