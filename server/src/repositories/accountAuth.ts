import { db } from '../db'

// ─────────────────────────────────────────────────────────────
// データアクセス層（リポジトリ）＝ DB と API の変換境界。
// - 今は SQLite を読み書き。本番はこの中身を客先DB/PHP呼び出しへ差し替え。
// - DB表現(tinyint 0/1) ⇄ API表現(boolean) の変換もここで行う。
// - 削除は論理削除（delfg=1）。一覧は delfg=0 のみ。
// ─────────────────────────────────────────────────────────────

// 読み取り型（レスポンス＝全カラム常に存在。? は使わず null可は `| null`）
export type AccountAuth = {
  id: number
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
  reg_date: string
  upd_date: string
  delfg: boolean
}

// 書き込み型（サーバー管理 id/reg_date/upd_date を除く。読み取りと対称。delfgはユーザーが手動編集するため含む）
export type AccountAuthInput = {
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
  delfg: boolean // 論理削除フラグ。ユーザーが手動編集（PUTで論理削除）。DELETE APIは未開放
}

// DBの生の行（tinyintはinteger）
type Row = Omit<AccountAuth, 'non_sync' | 'delfg'> & { non_sync: number; delfg: number }

// DB行(tinyint) → API(boolean)
function toApi(row: Row): AccountAuth {
  return { ...row, non_sync: row.non_sync === 1, delfg: row.delfg === 1 }
}

const nowStr = () => new Date().toISOString().slice(0, 19).replace('T', ' ')

export function listAccountAuth(): AccountAuth[] {
  const rows = db
    .prepare('SELECT * FROM account_auth WHERE delfg = 0 ORDER BY id')
    .all() as Row[]
  return rows.map(toApi)
}

// 差分計算用：論理削除(delfg=1)も含めた全件（リストア判定に必要）
export function listAllAccountAuth(): AccountAuth[] {
  const rows = db.prepare('SELECT * FROM account_auth ORDER BY id').all() as Row[]
  return rows.map(toApi)
}

export function createAccountAuth(records: AccountAuthInput[]): { inserted: number } {
  const stmt = db.prepare(`
    INSERT INTO account_auth
      (username, password, comment, number, submission_date, regist_date,
       company_cd, company_name, company_store_cd, company_store_branch_num,
       non_sync, store_cd, store_name, reg_date, upd_date, delfg)
    VALUES
      (@username, @password, @comment, @number, @submission_date, @regist_date,
       @company_cd, @company_name, @company_store_cd, @company_store_branch_num,
       @non_sync, @store_cd, @store_name, @reg_date, @upd_date, @delfg)
  `)
  const tx = db.transaction((rows: AccountAuthInput[]) => {
    const ts = nowStr()
    for (const r of rows) {
      stmt.run({ ...r, non_sync: r.non_sync ? 1 : 0, delfg: r.delfg ? 1 : 0, reg_date: ts, upd_date: ts })
    }
  })
  tx(records)
  return { inserted: records.length }
}

export function updateAccountAuth(id: number, input: AccountAuthInput): AccountAuth | null {
  db.prepare(`
    UPDATE account_auth SET
      username = @username, password = @password, comment = @comment, number = @number,
      submission_date = @submission_date, regist_date = @regist_date,
      company_cd = @company_cd, company_name = @company_name,
      company_store_cd = @company_store_cd, company_store_branch_num = @company_store_branch_num,
      non_sync = @non_sync, store_cd = @store_cd, store_name = @store_name,
      delfg = @delfg, upd_date = @upd_date
    WHERE id = @id
  `).run({ ...input, id, non_sync: input.non_sync ? 1 : 0, delfg: input.delfg ? 1 : 0, upd_date: nowStr() })
  // delfg=0 を条件にしない：削除済み行の delfg を戻す（手動リストア）もこの関数で行うため

  // 更新後の行を返す。delfg=1（論理削除）にした直後でも返せるよう delfg 条件は付けない
  const row = db.prepare('SELECT * FROM account_auth WHERE id = ?').get(id) as Row | undefined
  return row ? toApi(row) : null
}

// 論理削除（delfg=1）
export function deleteAccountAuth(id: number): { deleted: number } {
  const info = db
    .prepare(`UPDATE account_auth SET delfg = 1, upd_date = ? WHERE id = ? AND delfg = 0`)
    .run(nowStr(), id)
  return { deleted: info.changes }
}

// ─────────────────────────────────────────────────────────────
// Excel取り込み適用（apply）専用。
//
// 【idで判定する】以前はusername一致でDB行を探していたが、username重複の
// レガシーデータ（客先の旧運用による現役データ）が存在するため、usernameだけ
// では「どの行を更新すべきか」を一意に決められない場合がある。差分計算
// （accountAuthDiff.ts の computeImportDiff）が既にNo.等で正しいDB行を
// 特定し、その id を渡してくる前提にすることで、この曖昧さを無くしている。
// added（新規追加）だけは対応するDB行が無い＝usernameで新規INSERTでよい
// （UNIQUE制約により、万一既存usernameと衝突すればDBレベルで弾かれる）。
// ─────────────────────────────────────────────────────────────

function insertAccountAuth(input: AccountAuthInput): void {
  const ts = nowStr()
  db.prepare(`
    INSERT INTO account_auth
      (username, password, comment, number, submission_date, regist_date,
       company_cd, company_name, company_store_cd, company_store_branch_num,
       non_sync, store_cd, store_name, reg_date, upd_date, delfg)
    VALUES
      (@username, @password, @comment, @number, @submission_date, @regist_date,
       @company_cd, @company_name, @company_store_cd, @company_store_branch_num,
       @non_sync, @store_cd, @store_name, @reg_date, @upd_date, @delfg)
  `).run({ ...input, non_sync: input.non_sync ? 1 : 0, delfg: input.delfg ? 1 : 0, reg_date: ts, upd_date: ts })
}

function updateAccountAuthByIdForImport(id: number, input: AccountAuthInput): void {
  db.prepare(`
    UPDATE account_auth SET
      username = @username, password = @password, comment = @comment, number = @number,
      submission_date = @submission_date, regist_date = @regist_date,
      company_cd = @company_cd, company_name = @company_name,
      company_store_cd = @company_store_cd, company_store_branch_num = @company_store_branch_num,
      non_sync = @non_sync, store_cd = @store_cd, store_name = @store_name,
      delfg = @delfg, upd_date = @upd_date
    WHERE id = @id
  `).run({ ...input, id, non_sync: input.non_sync ? 1 : 0, delfg: input.delfg ? 1 : 0, upd_date: nowStr() })
}

function setDelfgById(id: number, delfg: boolean): void {
  db.prepare('UPDATE account_auth SET delfg = ?, upd_date = ? WHERE id = ?').run(delfg ? 1 : 0, nowStr(), id)
}

export interface ApplyImportParams {
  added: AccountAuthInput[]
  changed: { id: number; after: AccountAuthInput }[]
  deleted: { id: number }[]
  restored: { id: number }[]
}

export interface ApplyImportResult {
  inserted: number
  updated: number
  deleted: number
  restored: number
}

// 承認された差分だけを1トランザクションで反映する。ファイルにある行だけ触る（安全）
export function applyAccountAuthImport(params: ApplyImportParams): ApplyImportResult {
  const tx = db.transaction(() => {
    for (const a of params.added) insertAccountAuth(a)
    for (const c of params.changed) updateAccountAuthByIdForImport(c.id, c.after)
    for (const d of params.deleted) setDelfgById(d.id, true)
    for (const r of params.restored) setDelfgById(r.id, false)
  })
  tx()
  return {
    inserted: params.added.length,
    updated: params.changed.length,
    deleted: params.deleted.length,
    restored: params.restored.length,
  }
}
