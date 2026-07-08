// ┌─────────────────────────────────────────────────────────────┐
// │ レイヤ: API関数（クライアント側の「データの出口」）            │
// │ 流れ:  画面 → フック → 【ここ】 → HTTP → Express(or MSW)      │
// │                                                               │
// │ 役割: fetch を呼ぶのはこのファイルだけ。URL・HTTPメソッド・    │
// │       エラー処理をここに集約する。                            │
// │ 型:   AccountAuth / AccountAuthInput は **サーバーのtsoa       │
// │       コントローラが生成した OpenAPI仕様から自動生成**         │
// │       （client/src/api/generated/schema.ts）。手書きの二重     │
// │       定義は廃止し、サーバーの型を単一の真実とする。           │
// │       更新は `yarn gen:api`（仕様→型を再生成）。               │
// └─────────────────────────────────────────────────────────────┘
import type { components } from './generated/schema'
import { ApiError } from './error'

export type AccountAuth = components['schemas']['AccountAuth']
export type AccountAuthInput = components['schemas']['AccountAuthInput']

// 失敗時は ApiError（status・body付き）を投げる → 画面側でフィールドエラーかトーストかを判断
async function fail(res: Response, fallback: string): Promise<never> {
  const body = await res.json().catch(() => ({}))
  const message = (body.error ?? body.message ?? `${fallback} (${res.status})`) as string
  throw new ApiError(res.status, body, message)
}

// includeDeleted=true で削除済み(delfg=1)も含める（手動リストア用）
export async function fetchAccountAuthList(includeDeleted = false): Promise<AccountAuth[]> {
  const res = await fetch(`/api/account-auth${includeDeleted ? '?includeDeleted=true' : ''}`)
  if (!res.ok) return fail(res, 'アカウント認証一覧の取得に失敗しました')
  return res.json()
}

// 手入力1件もExcel取り込み複数件も同じ口
export async function createAccountAuth(records: AccountAuthInput[]): Promise<{ inserted: number }> {
  const res = await fetch('/api/account-auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ records }),
  })
  if (!res.ok) return fail(res, '追加に失敗しました')
  return res.json()
}

export async function updateAccountAuth(id: number, input: AccountAuthInput): Promise<AccountAuth> {
  const res = await fetch(`/api/account-auth/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) return fail(res, '更新に失敗しました')
  return res.json()
}

export async function deleteAccountAuth(id: number): Promise<{ deleted: number }> {
  const res = await fetch(`/api/account-auth/${id}`, { method: 'DELETE' })
  if (!res.ok) return fail(res, '削除に失敗しました')
  return res.json()
}
