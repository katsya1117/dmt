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

// ─── マスタ: 車種・型式（仮スキーマ。本番は客先DB/dbdに合わせ込む） ───
db.exec(`
  CREATE TABLE IF NOT EXISTS vehicle (
    id    TEXT PRIMARY KEY,   -- 車種ID
    code  TEXT NOT NULL,      -- 車種コード
    name  TEXT NOT NULL       -- 車種名
  );
  CREATE TABLE IF NOT EXISTS katashiki (
    id         TEXT PRIMARY KEY,  -- 型式ID
    vehicle_id TEXT NOT NULL,     -- 所属する車種ID
    code       TEXT NOT NULL,     -- 型式コード
    year       TEXT NOT NULL,     -- 年式
    name       TEXT NOT NULL      -- 型式名
  );
`)

const vehicleCount = (db.prepare('SELECT COUNT(*) AS c FROM vehicle').get() as { c: number }).c
if (vehicleCount === 0) {
  const vins = db.prepare('INSERT INTO vehicle (id, code, name) VALUES (?, ?, ?)')
  const kins = db.prepare('INSERT INTO katashiki (id, vehicle_id, code, year, name) VALUES (?, ?, ?, ?, ?)')
  const vehicles: [string, string, string][] = [
    ['V001', 'ABC', 'アルファ'],
    ['V002', 'XYZ', 'ゼータ'],
    ['V003', 'LMN', 'ルミナ'],
  ]
  // 型式 = 車種 × 年式
  const katashiki: [string, string, string, string, string][] = [
    ['ABC-2021', 'V001', 'ABC', '2021', 'アルファ 2021'],
    ['ABC-2022', 'V001', 'ABC', '2022', 'アルファ 2022'],
    ['ABC-2023', 'V001', 'ABC', '2023', 'アルファ 2023'],
    ['XYZ-2020', 'V002', 'XYZ', '2020', 'ゼータ 2020'],
    ['XYZ-2021', 'V002', 'XYZ', '2021', 'ゼータ 2021'],
    ['LMN-2022', 'V003', 'LMN', '2022', 'ルミナ 2022'],
  ]
  const tx = db.transaction(() => {
    vehicles.forEach((v) => vins.run(...v))
    katashiki.forEach((k) => kins.run(...k))
  })
  tx()
}
