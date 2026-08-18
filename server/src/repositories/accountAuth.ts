import { callAmfphpService } from '../services/amfphpClient'
import { hashPassword } from '../utils/hashPassword'

// ─────────────────────────────────────────────────────────────
// データアクセス層（リポジトリ）＝ DB と API の変換境界。
// 客先PHP（AMFPHPのJSONプラグイン経由。詳細はservices/amfphpClient.ts）を
// DbManagerTInetUserAuth.load/updateで呼び出す。関数のシグネチャ（引数・戻り値の型）は
// SQLite版デモの頃と同じに保ってあり、呼び出し側（コントローラー）は無改修。
// - DB表現(tinyint 0/1 ・ 文字列で返る場合あり) ⇄ API表現(boolean) の変換もここで行う。
// - 削除は論理削除（delfg=1）。一覧は全件返し、表示側で区別する。
// - パスワードは平文を保存せずMD5ハッシュで保存する（客先仕様、変更不可）。
//   新規追加・Excel取り込みは常に平文が渡ってくる前提で毎回ハッシュ化する。
//   手動更新（updateAccountAuth）だけは「パスワードを変更する」チェックが
//   OFFの場合に空文字が渡ってくる（クライアント側の規約）ため、ここで
//   「空文字なら既存ハッシュを維持・非空なら新規ハッシュ化」を解決する。
//
// 【AMFPHP側にレコード単位の部分更新が無いことについて】
// DbManagerTInetUserAuth.update()のUPDATE文は全カラムを無条件に上書きする
// （SET句を可変にする仕組みが無い）。そのためExcelの削除/リストア（本来は
// delfgとcommentだけを変えたい）も、他のカラムを消さないよう毎回「現在の
// 全カラム値」を読み直してから丸ごと送り直す必要がある（applyAccountAuthImport参照）
// ─────────────────────────────────────────────────────────────

const TARGET_TABLE_ID = 0 // t_inet_user_auth（要確認：t_inet_user_auth_ds3ではないか）

// 読み取り型（レスポンス＝全カラム常に存在。? は使わず null可は `| null`）
export type AccountAuth = {
  id: number
  accountName: string
  password: string
  comment: string | null
  number: number | null
  submission_date: string | null
  regist_date: string | null
  company_cd: string | null
  company_name: string | null
  company_store_cd: string | null
  company_store_branch_num: string | null
  non_sync: boolean
  store_cd: string | null
  store_name: string | null
  reg_date: string
  upd_date: string
  delfg: boolean
}

// 書き込み型（サーバー管理 id/reg_date/upd_date を除く。読み取りと対称。delfgはユーザーが手動編集するため含む）
export type AccountAuthInput = {
  accountName: string
  password: string
  comment: string | null
  number: number | null
  submission_date: string | null
  regist_date: string | null
  company_cd: string | null
  company_name: string | null
  company_store_cd: string | null
  company_store_branch_num: string | null
  non_sync: boolean
  store_cd: string | null
  store_name: string | null
  delfg: boolean // 論理削除フラグ。ユーザーが手動編集（PUTで論理削除）。DELETE APIは未開放
}

// AMFPHP(DbManagerTInetUserAuth.load)がSELECTで返す生の行。
// PHP側はカラム名が今もusername（accountNameへのリネームはこのアプリ側のみ）。
// 数値・真偽値はDB実装（MySQL/SQLite）により文字列で返ることがあるため緩く受ける
type PhpRow = {
  id: number | string
  username: string
  password: string
  comment: string | null
  number: number | string | null
  submission_date: string | null
  regist_date: string | null
  company_cd: string | null
  company_name: string | null
  company_store_cd: string | null
  company_store_branch_num: string | null
  non_sync: number | string
  store_cd: string | null
  store_name: string | null
  reg_date: string
  upd_date: string
  delfg: number | string
}

function toApi(row: PhpRow): AccountAuth {
  return {
    id: Number(row.id),
    accountName: row.username,
    password: row.password,
    comment: row.comment,
    number: row.number === null ? null : Number(row.number),
    submission_date: row.submission_date,
    regist_date: row.regist_date,
    company_cd: row.company_cd,
    company_name: row.company_name,
    company_store_cd: row.company_store_cd,
    company_store_branch_num: row.company_store_branch_num,
    non_sync: String(row.non_sync) === '1',
    store_cd: row.store_cd,
    store_name: row.store_name,
    reg_date: row.reg_date,
    upd_date: row.upd_date,
    delfg: String(row.delfg) === '1',
  }
}

// AMFPHP(DbManagerTInetUserAuth.update)へ渡す1レコード分（$info相当）
type PhpInfo = {
  updatemark: 'INSERT' | 'UPDATE' | 'DELETE'
  id?: number
  username: string
  password: string
  comment: string | null
  number: number | null
  submission_date: string | null
  regist_date: string | null
  company_cd: string | null
  company_name: string | null
  company_store_cd: string | null
  company_store_branch_num: string | null
  non_sync: boolean
  store_cd: string | null
  store_name: string | null
  delfg: boolean
}

function toPhpInfo(input: AccountAuthInput, updatemark: PhpInfo['updatemark'], id?: number): PhpInfo {
  return {
    updatemark,
    id,
    username: input.accountName,
    password: input.password,
    comment: input.comment,
    number: input.number,
    submission_date: input.submission_date,
    regist_date: input.regist_date,
    company_cd: input.company_cd,
    company_name: input.company_name,
    company_store_cd: input.company_store_cd,
    company_store_branch_num: input.company_store_branch_num,
    non_sync: input.non_sync,
    store_cd: input.store_cd,
    store_name: input.store_name,
    delfg: input.delfg,
  }
}

// AccountAuth（読み取り型）をAccountAuthInput（書き込み型）に変換する。
// 「今の値をそのまま送り直す」（delfg更新など部分更新の代替）ときに使う
function toInput(row: AccountAuth): AccountAuthInput {
  const { id: _id, reg_date: _reg, upd_date: _upd, ...rest } = row
  return rest
}

// 論理削除(delfg=1)も含めた全件（削除済み行は「状態」列で区別して表示する）
export async function listAllAccountAuth(): Promise<AccountAuth[]> {
  const rows = await callAmfphpService<PhpRow[]>('DbManagerTInetUserAuth', 'load', [TARGET_TABLE_ID])
  return rows.map(toApi)
}

export async function createAccountAuth(records: AccountAuthInput[]): Promise<{ inserted: number }> {
  const data = records.map((r) => toPhpInfo({ ...r, password: hashPassword(r.password) }, 'INSERT'))
  await callAmfphpService('DbManagerTInetUserAuth', 'update', [TARGET_TABLE_ID, data])
  return { inserted: records.length }
}

export async function updateAccountAuth(id: number, input: AccountAuthInput): Promise<AccountAuth | null> {
  const all = await listAllAccountAuth()
  const current = all.find((r) => r.id === id)
  if (!current) return null

  // 空文字＝「パスワードを変更する」チェックOFF（クライアント側の規約）→既存ハッシュを維持。
  // 非空＝新しい平文が入力された→ハッシュ化して上書き（既存ハッシュを再ハッシュしない）
  const password = input.password.trim() === '' ? current.password : hashPassword(input.password)

  await callAmfphpService('DbManagerTInetUserAuth', 'update', [
    TARGET_TABLE_ID,
    [toPhpInfo({ ...input, password }, 'UPDATE', id)],
  ])

  const updated = await listAllAccountAuth()
  return updated.find((r) => r.id === id) ?? null
}

// 論理削除（delfg=1）。現状DELETE APIは未開放（コントローラ側コメント参照）で未使用だが、
// 将来開放する時のために残す。AMFPHP側に部分更新が無いため、現在の全カラムを読み直してから
// delfgだけ変えて丸ごと送り直す
export async function deleteAccountAuth(id: number): Promise<{ deleted: number }> {
  const all = await listAllAccountAuth()
  const current = all.find((r) => r.id === id && !r.delfg)
  if (!current) return { deleted: 0 }

  await callAmfphpService('DbManagerTInetUserAuth', 'update', [
    TARGET_TABLE_ID,
    [toPhpInfo({ ...toInput(current), delfg: true }, 'UPDATE', id)],
  ])
  return { deleted: 1 }
}

// ─────────────────────────────────────────────────────────────
// Excel取り込み適用（apply）専用。
//
// 【idで判定する】以前はaccountName一致でDB行を探していたが、accountName重複の
// レガシーデータ（客先の旧運用による現役データ）が存在するため、accountNameだけ
// では「どの行を更新すべきか」を一意に決められない場合がある。差分計算
// （accountAuthDiff.ts の computeImportDiff）が既にNo.等で正しいDB行を
// 特定し、その id を渡してくる前提にすることで、この曖昧さを無くしている。
// added（新規追加）だけは対応するDB行が無い＝accountNameで新規INSERTでよい
// （accountNameにDB UNIQUE制約は無いが、computeImportDiffの構造上、既存行と
// accountNameが一致する行はaddedではなくchanged/deleted/restoredに分類される
// ため、addedに既存accountNameと衝突するものは混ざらない）。
//
// 【1回のAMFPHP呼び出しにまとめる】DbManagerTInetUserAuth.update()は
// updatemarkの異なる複数レコードを1配列で受け取れるため、add/changed/
// deleted/restoredを1本の配列にまとめて1回のHTTP呼び出しで送る
// （SQLite版のような複数トランザクションの代わり。AMFPHP側が全体をどこまで
// 原子的に扱うかは実装依存で保証はない）。
// ─────────────────────────────────────────────────────────────

export interface ApplyImportParams {
  added: AccountAuthInput[]
  changed: { id: number; after: AccountAuthInput }[]
  deleted: { id: number; comment: string }[]
  restored: { id: number; comment: string }[]
}

export interface ApplyImportResult {
  inserted: number
  updated: number
  deleted: number
  restored: number
}

export async function applyAccountAuthImport(params: ApplyImportParams): Promise<ApplyImportResult> {
  // deleted/restoredはid+commentしか持たない（delfg以外のカラムは変えたくない）が、
  // AMFPHP側は全カラム上書きのUPDATEしか無いため、現在の全カラムを読み直して埋める
  const needsCurrent = params.deleted.length > 0 || params.restored.length > 0
  const currentById = new Map((needsCurrent ? await listAllAccountAuth() : []).map((r) => [r.id, r]))

  const data: PhpInfo[] = []

  for (const a of params.added) {
    data.push(toPhpInfo({ ...a, password: hashPassword(a.password) }, 'INSERT'))
  }
  for (const c of params.changed) {
    // Excel取り込みは常に平文パスワードが渡ってくる前提（客先ファイルの列がそのまま）で
    // 毎回ハッシュ化する。手動更新のような「空文字＝維持」の分岐は無い
    data.push(toPhpInfo({ ...c.after, password: hashPassword(c.after.password) }, 'UPDATE', c.id))
  }
  for (const d of params.deleted) {
    const current = currentById.get(d.id)
    if (!current) throw new Error(`account_auth id=${d.id} が見つかりません`)
    data.push(toPhpInfo({ ...toInput(current), delfg: true, comment: d.comment }, 'UPDATE', d.id))
  }
  for (const r of params.restored) {
    const current = currentById.get(r.id)
    if (!current) throw new Error(`account_auth id=${r.id} が見つかりません`)
    data.push(toPhpInfo({ ...toInput(current), delfg: false, comment: r.comment }, 'UPDATE', r.id))
  }

  if (data.length > 0) {
    await callAmfphpService('DbManagerTInetUserAuth', 'update', [TARGET_TABLE_ID, data])
  }

  return {
    inserted: params.added.length,
    updated: params.changed.length,
    deleted: params.deleted.length,
    restored: params.restored.length,
  }
}
