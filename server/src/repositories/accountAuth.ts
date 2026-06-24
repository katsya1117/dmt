import { db } from '../db'

// ─────────────────────────────────────────────────────────────
// データアクセス層（リポジトリ）。
// 今は SQLite を直接読み書きしているが、本番ではこのファイルの中身を
// 「PHP(REST)サーバーへの fetch 呼び出し」に差し替えるだけでよい。
// ルート側はこのインターフェースしか知らない。
// ─────────────────────────────────────────────────────────────

export type AccountAuth = {
  id: number
  account_id: string
  auth_key: string
  valid_until: string | null
  enabled: number // 0 | 1
  updated_at: string
}

export type AccountAuthInput = {
  account_id: string
  auth_key: string
  valid_until?: string | null
  enabled?: number
}

export function listAccountAuth(): AccountAuth[] {
  return db.prepare('SELECT * FROM account_auth ORDER BY id').all() as AccountAuth[]
}

export function createAccountAuth(records: AccountAuthInput[]): { inserted: number } {
  const stmt = db.prepare(
    `INSERT INTO account_auth (account_id, auth_key, valid_until, enabled)
     VALUES (@account_id, @auth_key, @valid_until, @enabled)`
  )
  const tx = db.transaction((rows: AccountAuthInput[]) => {
    for (const r of rows) {
      stmt.run({
        account_id: r.account_id,
        auth_key: r.auth_key,
        valid_until: r.valid_until ?? null,
        enabled: r.enabled ?? 1,
      })
    }
  })
  tx(records)
  return { inserted: records.length }
}

export function updateAccountAuth(id: number, input: AccountAuthInput): AccountAuth | null {
  db.prepare(
    `UPDATE account_auth
       SET account_id = @account_id,
           auth_key = @auth_key,
           valid_until = @valid_until,
           enabled = @enabled,
           updated_at = datetime('now', 'localtime')
     WHERE id = @id`
  ).run({
    id,
    account_id: input.account_id,
    auth_key: input.auth_key,
    valid_until: input.valid_until ?? null,
    enabled: input.enabled ?? 1,
  })
  return (db.prepare('SELECT * FROM account_auth WHERE id = ?').get(id) as AccountAuth) ?? null
}

export function deleteAccountAuth(id: number): { deleted: number } {
  const info = db.prepare('DELETE FROM account_auth WHERE id = ?').run(id)
  return { deleted: info.changes }
}
