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
// 操作対象のテーブル。normal=通常アカウント／diag=DIAG用アカウント（同じ構造の別テーブル）
export type AccountAuthTarget = components['schemas']['AccountAuthTarget']
// 権限は三者択一（なし／ALL_MANUAL／HTML_BROWSING）。権限は通常アカウントにだけ付く
export type Authority = components['schemas']['Authority']

// 削除済み(delfg=1)も含めた全件を返す（手動リストア用に「状態」列で区別する）
export async function fetchAccountAuthList(target: AccountAuthTarget = 'normal'): Promise<AccountAuth[]> {
  try {
    const res = await http.get<AccountAuth[]>('/api/account-auth', { params: { target } })
    return res.data
  } catch (err) {
    throw toApiError(err, 'アカウント認証一覧の取得に失敗しました')
  }
}

// 手入力1件もExcel取り込み複数件も同じ口。authorities指定時はrecordsと同じ
// 並び・同じ長さの配列（省略時は権限に一切触れない）
export async function createAccountAuth(
  records: AccountAuthInput[],
  authorities?: (Authority | null)[],
): Promise<{ inserted: number }> {
  try {
    const res = await http.post<{ inserted: number }>('/api/account-auth', { records, authorities })
    return res.data
  } catch (err) {
    throw toApiError(err, '追加に失敗しました')
  }
}

// authority省略時（undefined）は権限に一切触れない。null＝権限を外す、という
// 明示的な選択と区別するため、「指定しない」はundefinedのまま呼び出すこと
export async function updateAccountAuth(
  id: number,
  input: AccountAuthInput,
  target: AccountAuthTarget = 'normal',
  authority?: Authority | null,
): Promise<AccountAuth> {
  try {
    const res = await http.put<AccountAuth>(`/api/account-auth/${id}`, { input, authority }, { params: { target } })
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
