import { db } from '../db'

// ─────────────────────────────────────────────────────────────
// 車種・型式マスタのデータアクセス層。
// 今は SQLite を読むが、本番ではこの中身を「客先DB/PHPへの問い合わせ」に
// 差し替えるだけでよい。将来 dbd ファイル取り込みも、ここに別ソースとして
// 流し込む形で対応できる（ルート/コンポーネントは無変更）。
// ─────────────────────────────────────────────────────────────

export type Vehicle = {
  id: string
  code: string
  name: string
}

export type Katashiki = {
  id: string
  vehicle_id: string
  code: string
  year: string
  name: string
}

export function listVehicles(): Vehicle[] {
  return db.prepare('SELECT * FROM vehicle ORDER BY code').all() as Vehicle[]
}

export function listKatashiki(vehicleId?: string): Katashiki[] {
  if (vehicleId) {
    return db
      .prepare('SELECT * FROM katashiki WHERE vehicle_id = ? ORDER BY year')
      .all(vehicleId) as Katashiki[]
  }
  return db.prepare('SELECT * FROM katashiki ORDER BY code, year').all() as Katashiki[]
}
