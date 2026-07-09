// 車種・型式マスタ。客先DB（Express経由）から取得する。
// ※ api/types.ts の Katashiki（Sambaフォルダ名の一覧）とは別概念。
//   こちらは「車種×年式」のマスタレコード。
import { http, axiosStatusOf } from './http'

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
  try {
    const res = await http.get<Vehicle[]>('/api/master/vehicles')
    return res.data
  } catch (err) {
    throw new Error(`車種一覧の取得に失敗しました (${axiosStatusOf(err)})`)
  }
}

export async function fetchKatashiki(vehicleId?: string): Promise<Katashiki[]> {
  try {
    const res = await http.get<Katashiki[]>('/api/master/katashiki', {
      params: vehicleId ? { vehicleId } : undefined,
    })
    return res.data
  } catch (err) {
    throw new Error(`型式一覧の取得に失敗しました (${axiosStatusOf(err)})`)
  }
}
