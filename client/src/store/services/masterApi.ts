// ┌─────────────────────────────────────────────────────────────┐
// │ レイヤ: RTK Query APIスライス（サーバー状態のキャッシュ・取得管理）│
// │ 流れ:  画面 → フック → 【ここ】 → API関数(api/master.ts) → HTTP │
// │                                                               │
// │ 役割: axiosを呼ぶ api/master.ts はそのまま使い、ここではキャッ  │
// │       シュ・重複排除・再取得だけを引き受ける（queryFnで既存の  │
// │       API関数をラップするだけで、HTTP呼び出し自体は増やさない）│
// └─────────────────────────────────────────────────────────────┘
import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'
import { fetchVehicles, fetchKatashiki, type Vehicle, type Katashiki } from '../../api/master'

export const masterApi = createApi({
  reducerPath: 'masterApi',
  baseQuery: fakeBaseQuery<Error>(),
  endpoints: (builder) => ({
    vehicles: builder.query<Vehicle[], void>({
      queryFn: async () => {
        try {
          return { data: await fetchVehicles() }
        } catch (err) {
          return { error: err as Error }
        }
      },
    }),
    katashiki: builder.query<Katashiki[], string | undefined>({
      queryFn: async (vehicleId) => {
        try {
          return { data: await fetchKatashiki(vehicleId) }
        } catch (err) {
          return { error: err as Error }
        }
      },
    }),
  }),
})
