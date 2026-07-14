import { masterApi } from '../store/services/masterApi'

// 車種未選択のうちは型式を取りに行かない（vehicleId===''のときだけskip）という
// 実ロジックがあるためラップする。単なる名前の付け替えだけならこのファイルは作らない
// （useVehicles等は masterApi.useVehiclesQuery を画面から直接呼ぶ。詳細は
// docs/画面実装パターン.md参照）。
export function useKatashiki(vehicleId?: string) {
  return masterApi.useKatashikiQuery(vehicleId, { skip: vehicleId === '' })
}
