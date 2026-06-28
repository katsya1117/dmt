// 車種・型式マスタ。客先DB（Express経由）から取得する。
// ※ api/types.ts の Katashiki（Sambaフォルダ名の一覧）とは別概念。
//   こちらは「車種×年式」のマスタレコード。

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

export async function fetchVehicles(): Promise<Vehicle[]> {
  const res = await fetch('/api/master/vehicles')
  if (!res.ok) throw new Error(`車種一覧の取得に失敗しました (${res.status})`)
  return res.json()
}

export async function fetchKatashiki(vehicleId?: string): Promise<Katashiki[]> {
  const qs = vehicleId ? `?vehicleId=${encodeURIComponent(vehicleId)}` : ''
  const res = await fetch(`/api/master/katashiki${qs}`)
  if (!res.ok) throw new Error(`型式一覧の取得に失敗しました (${res.status})`)
  return res.json()
}
