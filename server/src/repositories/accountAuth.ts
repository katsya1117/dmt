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

// 書き込み型（サーバー管理 id/reg_date/upd_date/delfg を除く。読み取りと対称）
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

export function createAccountAuth(records: AccountAuthInput[]): { inserted: number } {
  const stmt = db.prepare(`
    INSERT INTO account_auth
      (username, password, comment, number, submission_date, regist_date,
       company_cd, company_name, company_store_cd, company_store_branch_num,
       non_sync, store_cd, store_name, reg_date, upd_date, delfg)
    VALUES
      (@username, @password, @comment, @number, @submission_date, @regist_date,
       @company_cd, @company_name, @company_store_cd, @company_store_branch_num,
       @non_sync, @store_cd, @store_name, @reg_date, @upd_date, 0)
  `)
  const tx = db.transaction((rows: AccountAuthInput[]) => {
    const ts = nowStr()
    for (const r of rows) {
      stmt.run({ ...r, non_sync: r.non_sync ? 1 : 0, reg_date: ts, upd_date: ts })
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
      upd_date = @upd_date
    WHERE id = @id AND delfg = 0
  `).run({ ...input, id, non_sync: input.non_sync ? 1 : 0, upd_date: nowStr() })

  const row = db.prepare('SELECT * FROM account_auth WHERE id = ? AND delfg = 0').get(id) as Row | undefined
  return row ? toApi(row) : null
}

// 論理削除（delfg=1）
export function deleteAccountAuth(id: number): { deleted: number } {
  const info = db
    .prepare(`UPDATE account_auth SET delfg = 1, upd_date = ? WHERE id = ? AND delfg = 0`)
    .run(nowStr(), id)
  return { deleted: info.changes }
}
