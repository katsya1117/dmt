import { http, HttpResponse, delay } from 'msw'
import type { Vehicle, Katashiki } from '../api/master'

export const mockVehicles: Vehicle[] = [
  { id: 'V001', code: 'ABC', name: 'アルファ' },
  { id: 'V002', code: 'XYZ', name: 'ゼータ' },
  { id: 'V003', code: 'LMN', name: 'ルミナ' },
]

export const mockKatashiki: Katashiki[] = [
  { id: 'ABC-2021', vehicle_id: 'V001', code: 'ABC', year: '2021', name: 'アルファ 2021' },
  { id: 'ABC-2022', vehicle_id: 'V001', code: 'ABC', year: '2022', name: 'アルファ 2022' },
  { id: 'ABC-2023', vehicle_id: 'V001', code: 'ABC', year: '2023', name: 'アルファ 2023' },
  { id: 'XYZ-2020', vehicle_id: 'V002', code: 'XYZ', year: '2020', name: 'ゼータ 2020' },
  { id: 'XYZ-2021', vehicle_id: 'V002', code: 'XYZ', year: '2021', name: 'ゼータ 2021' },
  { id: 'LMN-2022', vehicle_id: 'V003', code: 'LMN', year: '2022', name: 'ルミナ 2022' },
]

export const masterHandlers = [
  http.get('/api/master/vehicles', async () => {
    await delay(150)
    return HttpResponse.json(mockVehicles)
  }),

  http.get('/api/master/katashiki', async ({ request }) => {
    await delay(150)
    const url = new URL(request.url)
    const vehicleId = url.searchParams.get('vehicleId')
    const rows = vehicleId ? mockKatashiki.filter((k) => k.vehicle_id === vehicleId) : mockKatashiki
    return HttpResponse.json(rows)
  }),
]
