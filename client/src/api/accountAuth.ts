// ┌─────────────────────────────────────────────────────────────┐
// │ レイヤ: API関数（クライアント側の「データの出口」）            │
// │ 流れ:  画面 → フック → 【ここ】 → HTTP → Express(or MSW)      │
// │                                                               │
// │ 役割: axios を呼ぶのはこのファイルだけ。URL・HTTPメソッド・     │
// │       エラー処理をここに集約する。                            │
// │ 型:   AccountAuth / AccountAuthInput は **サーバーのtsoa       │
// │       コントローラが生成した OpenAPI仕様から自動生成**         │
// │       （client/src/api/generated/schema.ts）。手書きの二重     │
// │       定義は廃止し、サーバーの型を単一の真実とする。           │
// │       更新は `yarn gen:api`（仕様→型を再生成）。               │
// └─────────────────────────────────────────────────────────────┘
import type { components } from './generated/schema'
import { toApiError } from './error'
import { http } from './http'

export type AccountAuth = components['schemas']['AccountAuth']
export type AccountAuthInput = components['schemas']['AccountAuthInput']

// 削除済み(delfg=1)も含めた全件を返す（手動リストア用に「状態」列で区別する）
export async function fetchAccountAuthList(): Promise<AccountAuth[]> {
  try {
    const res = await http.get<AccountAuth[]>('/api/account-auth')
    return res.data
  } catch (err) {
    throw toApiError(err, 'アカウント認証一覧の取得に失敗しました')
  }
}

// 手入力1件もExcel取り込み複数件も同じ口
export async function createAccountAuth(records: AccountAuthInput[]): Promise<{ inserted: number }> {
  try {
    const res = await http.post<{ inserted: number }>('/api/account-auth', { records })
    return res.data
  } catch (err) {
    throw toApiError(err, '追加に失敗しました')
  }
}

export async function updateAccountAuth(id: number, input: AccountAuthInput): Promise<AccountAuth> {
  try {
    const res = await http.put<AccountAuth>(`/api/account-auth/${id}`, input)
    return res.data
  } catch (err) {
    throw toApiError(err, '更新に失敗しました')
  }
}

export async function deleteAccountAuth(id: number): Promise<{ deleted: number }> {
  try {
    const res = await http.delete<{ deleted: number }>(`/api/account-auth/${id}`)
    return res.data
  } catch (err) {
    throw toApiError(err, '削除に失敗しました')
  }
}
