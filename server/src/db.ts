import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

// デモ用ローカルDB。本番ではこの層をPHP(REST)呼び出しに差し替える。
const dbDir = path.resolve(__dirname, '../data')
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })

export const db = new Database(path.join(dbDir, 'demo.db'))
db.pragma('journal_mode = WAL')

// スキーマ（仮。後でAMFPHPの実テーブルに合わせ込む）
db.exec(`
  CREATE TABLE IF NOT EXISTS account_auth (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id  TEXT NOT NULL UNIQUE,
    auth_key    TEXT NOT NULL,
    valid_until TEXT,
    enabled     INTEGER NOT NULL DEFAULT 1,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  )
`)

// 初回のみデモデータを投入
const count = (db.prepare('SELECT COUNT(*) AS c FROM account_auth').get() as { c: number }).c
if (count === 0) {
  const insert = db.prepare(
    `INSERT INTO account_auth (account_id, auth_key, valid_until, enabled) VALUES (?, ?, ?, ?)`
  )
  const seed: [string, string, string, number][] = [
    ['dealer001', 'KEY-AB12-CD34', '2027-03-31', 1],
    ['dealer002', 'KEY-EF56-GH78', '2027-03-31', 1],
    ['dealer003', 'KEY-IJ90-KL12', '2026-12-31', 0],
    ['admin-honsha', 'KEY-MN34-OP56', '2028-03-31', 1],
  ]
  const tx = db.transaction(() => seed.forEach((r) => insert.run(...r)))
  tx()
}
