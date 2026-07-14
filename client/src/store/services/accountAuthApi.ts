// ┌─────────────────────────────────────────────────────────────┐
// │ レイヤ: RTK Query APIスライス（サーバー状態のキャッシュ・取得管理）│
// │ 流れ:  画面 → 【ここ】 → API関数(api/accountAuth*.ts) → HTTP  │
// │                                                               │
// │ 役割: axiosを呼ぶ api/accountAuth.ts・api/accountAuthImport.ts │
// │       はそのまま使い、ここではキャッシュ・invalidate（更新後の │
// │       一覧自動再取得）だけを引き受ける。                       │
// │ エラー: api層が投げる ApiError をそのまま queryFn の error に  │
// │        乗せる。.unwrap() で同じ ApiError インスタンスが throw │
// │        されるため、呼び出し側の toFieldErrors 等は無変更。     │
// │ フック層は無い：ここのエンドポイント名が自動生成するフック名   │
// │ （useAccountAuthListQuery等）がそのまま画面から直接importされる│
// │ 名前になるよう、エンドポイント名を最初から機能名で書く。何も   │
// │ 足さないだけの再エクスポート層（hooks/useXxx.ts）は作らない    │
// │ （2026-07-14、中身の無い再エクスポート層を廃止。経緯は         │
// │  docs/画面実装パターン.md参照）。                              │
// └─────────────────────────────────────────────────────────────┘
import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'
import {
  fetchAccountAuthList,
  createAccountAuth,
  updateAccountAuth,
  deleteAccountAuth,
  type AccountAuth,
  type AccountAuthInput,
} from '../../api/accountAuth'
import { applyImport, type ApplyImportResult } from '../../api/accountAuthImport'
import type { ApiError } from '../../api/error'

export const accountAuthApi = createApi({
  reducerPath: 'accountAuthApi',
  baseQuery: fakeBaseQuery<ApiError>(),
  tagTypes: ['AccountAuth'],
  endpoints: (builder) => ({
    // includeDeleted=true で削除済み(delfg=1)も含める（手動リストア用）
    accountAuthList: builder.query<AccountAuth[], boolean | undefined>({
      queryFn: async (includeDeleted) => {
        try {
          return { data: await fetchAccountAuthList(includeDeleted) }
        } catch (err) {
          return { error: err as ApiError }
        }
      },
      providesTags: ['AccountAuth'],
    }),

    // 手入力1件もExcel取り込み複数件も同じ口
    createAccountAuth: builder.mutation<{ inserted: number }, AccountAuthInput[]>({
      queryFn: async (records) => {
        try {
          return { data: await createAccountAuth(records) }
        } catch (err) {
          return { error: err as ApiError }
        }
      },
      invalidatesTags: ['AccountAuth'],
    }),

    updateAccountAuth: builder.mutation<AccountAuth, { id: number; input: AccountAuthInput }>({
      queryFn: async ({ id, input }) => {
        try {
          return { data: await updateAccountAuth(id, input) }
        } catch (err) {
          return { error: err as ApiError }
        }
      },
      invalidatesTags: ['AccountAuth'],
    }),

    // 【削除機能 未開放】客先DBで物理削除が不調のため。論理削除は updateAccountAuth の delfg で行う。
    removeAccountAuth: builder.mutation<{ deleted: number }, number>({
      queryFn: async (id) => {
        try {
          return { data: await deleteAccountAuth(id) }
        } catch (err) {
          return { error: err as ApiError }
        }
      },
      invalidatesTags: ['AccountAuth'],
    }),

    applyAccountAuthImportDiff: builder.mutation<ApplyImportResult, File>({
      queryFn: async (file) => {
        try {
          return { data: await applyImport(file) }
        } catch (err) {
          return { error: err as ApiError }
        }
      },
      invalidatesTags: ['AccountAuth'],
    }),
  }),
})
