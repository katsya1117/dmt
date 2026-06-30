import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

// デモ用ローカルDB。本番ではこの層をPHP(REST)呼び出しに差し替える。
const dbDir = path.resolve(__dirname, '../data')
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })

export const db = new Database(path.join(dbDir, 'demo.db'))
db.pragma('journal_mode = WAL')

// 実スキーマ（客先MySQLのaccount_authに準拠。SQLite向けに型を読み替え）
// MySQL: tinyint(1)→INTEGER(0/1) / date・datetime・timestamp→TEXT
db.exec(`
  CREATE TABLE IF NOT EXISTS account_auth (
    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
    username                 TEXT NOT NULL UNIQUE,
    password                 TEXT NOT NULL,
    comment                  TEXT,
    number                   INTEGER,
    submission_date          TEXT,
    regist_date              TEXT,
    company_cd               TEXT,
    company_name             TEXT,
    company_store_cd         TEXT,
    company_store_branch_num TEXT,
    non_sync                 INTEGER NOT NULL DEFAULT 0,
    store_cd                 TEXT,
    store_name               TEXT,
    reg_date                 TEXT NOT NULL,
    upd_date                 TEXT NOT NULL,
    delfg                    INTEGER NOT NULL DEFAULT 0
  )
`)

// 初回のみデモデータを投入
const count = (db.prepare('SELECT COUNT(*) AS c FROM account_auth').get() as { c: number }).c
if (count === 0) {
  const insert = db.prepare(`
    INSERT INTO account_auth
      (username, password, comment, number, submission_date, regist_date,
       company_cd, company_name, company_store_cd, company_store_branch_num,
       non_sync, store_cd, store_name, reg_date, upd_date, delfg)
    VALUES
      (@username, @password, @comment, @number, @submission_date, @regist_date,
       @company_cd, @company_name, @company_store_cd, @company_store_branch_num,
       @non_sync, @store_cd, @store_name, @reg_date, @upd_date, @delfg)
  `)
  const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const seed = [
    { username: 'dealer001', password: 'pw-001', comment: '東日本エリア', number: 1001,
      submission_date: '2024-04-01', regist_date: '2024-04-05',
      company_cd: 'C01', company_name: '北日本販売', company_store_cd: 'CS01', company_store_branch_num: '01',
      non_sync: 0, store_cd: 'S001', store_name: '札幌中央店', reg_date: nowStr, upd_date: nowStr, delfg: 0 },
    { username: 'dealer002', password: 'pw-002', comment: null, number: 1002,
      submission_date: '2024-05-10', regist_date: '2024-05-12',
      company_cd: 'C02', company_name: '東日本販売', company_store_cd: 'CS02', company_store_branch_num: '03',
      non_sync: 1, store_cd: 'S002', store_name: '仙台駅前店', reg_date: nowStr, upd_date: nowStr, delfg: 0 },
    { username: 'admin-honsha', password: 'pw-adm', comment: '本社管理', number: 9001,
      submission_date: null, regist_date: '2023-01-01',
      company_cd: 'C00', company_name: '本社', company_store_cd: null, company_store_branch_num: null,
      non_sync: 0, store_cd: null, store_name: null, reg_date: nowStr, upd_date: nowStr, delfg: 0 },
  ]
  const tx = db.transaction(() => seed.forEach((r) => insert.run(r)))
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
