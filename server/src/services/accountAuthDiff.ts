import type { AccountAuth, AccountAuthInput } from '../repositories/accountAuth'
import knownNumbers from '../data/accountAuthExcelKnownNumbers.json'
import { hashPassword } from '../utils/hashPassword'

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
  // ファイル内重複などの検証エラー（validateImportRecordsと同じ内容）。
  // プレビュー時点で気づけるように、差分計算自体は止めずここに載せて返す
  validationErrors: string[]
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
// 更新方法：コードではなく server/src/data/accountAuthExcelKnownNumbers.json の
// legacyDuplicateNumbers配列に対象レコードのNo.を追加/削除するだけでよい
// （実行環境ごとに変わる設定ではなく業務データのため、envではなく専用のJSON
// データファイルに分離している。2026-07-16。client/src/data/の同名ファイルは
// MSWモック用の鏡なので、更新時は両方揃えること）
// （2026-07-13時点、実際のNo.は未確定 — 客先に確認の上で埋めること）
// ─────────────────────────────────────────────────────────────
const LEGACY_DUPLICATE_NUMBERS: readonly number[] = knownNumbers.legacyDuplicateNumbers

function isKnownLegacyDuplicate(record: Pick<AccountAuthInput, 'number'>): boolean {
  return record.number != null && LEGACY_DUPLICATE_NUMBERS.includes(record.number)
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
    skippedDuplicateUsernames: [], validationErrors: [],
  }
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
        // 新規追加はExcelのcomment列を使わず常に空で始める（備考は運用担当者が
        // アプリ上で手動で書くもので、Excel由来の値を持ち込まない）
        diff.added.push({ ...r, comment: null })
      }
      continue
    }
    // 削除／リストアは delfg の遷移で判定。備考に「yyyy/mm/dd 削除」「yyyy/mm/dd 再登録」を自動追記する
    if (r.delfg && !cur.delfg) {
      diff.deleted.push({ username: r.username, before: cur, after: { ...r, comment: appendComment(cur.comment, `${todayStr()} 削除`) } })
      continue
    }
    if (!r.delfg && cur.delfg) {
      diff.restored.push({ username: r.username, before: cur, after: { ...r, comment: appendComment(cur.comment, `${todayStr()} 再登録`) } })
      continue
    }
    // それ以外は項目の差分（レガシー重複行でも同様に検知・適用対象にする）。
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
      diff.changed.push({ username: r.username, before: cur, after, changedFields })
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
// username重複は引き続き拒否する。
// usernameにDB UNIQUE制約は無い（客先の旧運用で重複usernameが現役で存在する
// ため）ので、この関数がusername重複を拒否する唯一の層。No.も同様にDB制約が
// 無いため、拒否できるのはこの関数だけ
//
// 【一意性チェックは「生きている行（delfg=false）同士」でのみ行う】客先の運用要望：
// 削除フラグを立てたレコードのNo./usernameは「空き」として扱い、別レコードで
// 再割り当てしたい。よって delfg=true の行はNo./username重複チェックの対象外
// （他の行のNo./usernameとぶつかっていても無視する）。ただし、リストア
// （delfg: true→false）によって「生きている行」同士が重複する場合は通常の
// 新規追加と同じ扱いで拒否する（呼び出し側は該当行をrecordsに含めて渡すことで
// 自然にこのチェックにかかる。特別扱いの分岐は用意しない）
//
// 【手動追加・手動更新（リストア含む）でも同じ関数を使う】Excel取り込みは
// 再アップロードされた全件を records に渡すため既存No./usernameも自然に
// 含まれるが、手動追加・更新は対象の1行だけしか持たない。
// existingNumbers/existingUsernames に「自分以外の生きているレコード」の
// No./usernameを渡すことで、手動操作からの呼び出しでも「既存データとの重複」
// を同じロジックで検知できる（Excel取り込みとバリデーションが分岐しないようにするため）
export function validateImportRecords(
  records: AccountAuthInput[],
  existingNumbers: ReadonlySet<number> = new Set(),
  existingUsernames: ReadonlySet<string> = new Set(),
): string[] {
  const errors: string[] = []
  // 【行番号(No.)も記録する】usernameそのものが重複の原因なので、usernameだけを
  // エラーメッセージに出しても「ファイルの何行目とどこが重複しているか」が
  // 分からない。初出の行番号を記録し、重複検出時に両方の行番号を提示する
  // （2026-07-16、ユーザー指摘。skippedDuplicateUsernamesで直した問題と同種）
  const firstSeenLine = new Map<string, string>()
  const firstSeenNumberLine = new Map<number, string>()
  for (const n of existingNumbers) firstSeenNumberLine.set(n, '既存データ')
  for (const u of existingUsernames) firstSeenLine.set(u, '既存データ')
  records.forEach((r, i) => {
    const line = i + 1
    if (!r.username) errors.push(`${line}行目：usernameが空です`)
    if (!r.password) errors.push(`${line}行目：passwordが空です`)
    // 削除済み行（delfg=true）はNo./usernameが「空き」扱いなので、一意性
    // チェックの対象から外す（他の行と重複していても無視／記録もしない）
    if (r.delfg) return
    if (r.number != null) {
      const firstNumber = firstSeenNumberLine.get(r.number)
      if (firstNumber != null) {
        errors.push(`${line}行目：No.が${firstNumber}と重複しています（No.は一意である必要があります）: ${r.number}`)
      } else {
        firstSeenNumberLine.set(r.number, `${line}行目`)
      }
    }
    if (isKnownLegacyDuplicate(r)) return
    if (r.username) {
      const first = firstSeenLine.get(r.username)
      if (first != null) {
        errors.push(`${line}行目：usernameが${first}と重複しています（新規の重複登録は許可されません）: ${r.username}`)
      } else {
        firstSeenLine.set(r.username, `${line}行目`)
      }
    }
  })
  return errors
}
