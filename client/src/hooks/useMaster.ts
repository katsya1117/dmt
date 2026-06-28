import { useQuery } from '@tanstack/react-query'
import { fetchVehicles, fetchKatashiki } from '../api/master'

export function useVehicles() {
  return useQuery({ queryKey: ['vehicles'], queryFn: fetchVehicles })
}

export function useKatashiki(vehicleId?: string) {
  return useQuery({
    queryKey: ['katashiki', vehicleId ?? 'all'],
    queryFn: () => fetchKatashiki(vehicleId),
    // 車種未選択のうちは型式を取りに行かない
    enabled: vehicleId !== undefined ? vehicleId !== '' : true,
  })
}
