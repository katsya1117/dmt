// ┌─────────────────────────────────────────────────────────────┐
// │ レイヤ: フック（サーバー状態の管理 = RTK Query）               │
// │ 流れ:  画面 → 【ここ】 → store/services/accountAuthApi.ts → API関数 → HTTP│
// │                                                               │
// │ 役割: store/services/accountAuthApi.ts が生成したRTK Queryの  │
// │       フックに、この機能用の名前を付けて再エクスポートするだけ。│
// │       「取得・キャッシュ・ローディング・再取得」の実体は       │
// │       accountAuthApi 側（invalidatesTags/providesTagsで       │
// │       更新後の一覧自動再取得を行う）。                         │
// │ 呼び方: useCreateAccountAuth() 等は [trigger, result] を返す   │
// │        RTK Query流。trigger(引数).unwrap() でPromise化できる。 │
// └─────────────────────────────────────────────────────────────┘
import { accountAuthApi } from '../store/services/accountAuthApi'

// includeDeleted=true で削除済み(delfg=1)も含める（手動リストア用）
export function useAccountAuthList(includeDeleted = false) {
  return accountAuthApi.useListQuery(includeDeleted)
}

export const useCreateAccountAuth = accountAuthApi.useCreateMutation
export const useUpdateAccountAuth = accountAuthApi.useUpdateMutation
export const useApplyAccountAuthImport = accountAuthApi.useApplyImportDiffMutation
// 【削除機能 未開放】客先DBで物理削除が不調のため。開放する時: accountAuthApi.useRemoveMutation
// export const useRemoveAccountAuth = accountAuthApi.useRemoveMutation
