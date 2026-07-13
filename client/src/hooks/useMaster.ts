import { masterApi } from '../store/services/masterApi'

export function useVehicles() {
  return masterApi.useVehiclesQuery()
}

export function useKatashiki(vehicleId?: string) {
  return masterApi.useKatashikiQuery(vehicleId, {
    // 車種未選択のうちは型式を取りに行かない（vehicleId===''のときだけskip）
    skip: vehicleId === '',
  })
}
