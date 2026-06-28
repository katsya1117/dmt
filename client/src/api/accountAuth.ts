// ┌─────────────────────────────────────────────────────────────┐
// │ レイヤ: API関数（クライアント側の「データの出口」）            │
// │ 流れ:  画面 → フック → 【ここ】 → HTTP → Express(or MSW)      │
// │                                                               │
// │ 役割: fetch を呼ぶのはこのファイルだけ。URL・HTTPメソッド・    │
// │       エラー処理をここに集約する。画面やフックは fetch を      │
// │       直接知らない（差し替え・テストが楽になる）。            │
// │ 型:   サーバーと受け渡しするデータの形（AccountAuth /         │
// │       AccountAuthInput）もここで定義し、各層で共有する。       │
// └─────────────────────────────────────────────────────────────┘

// サーバーから返ってくる1件の形（読み取り用。idやupdated_atを含む）
export type AccountAuth = {
  id: number
  account_id: string
  auth_key: string
  valid_until: string | null
  enabled: number // 0 | 1
  updated_at: string
}

// 追加・更新で送る形（idやupdated_atはサーバーが決めるので持たない）

export type AccountAuthInput = {
  account_id: string
  auth_key: string
  valid_until?: string | null
  enabled?: number
}

export async function fetchAccountAuthList(): Promise<AccountAuth[]> {
  const res = await fetch('/api/account-auth')
  if (!res.ok) throw new Error(`アカウント認証一覧の取得に失敗しました (${res.status})`)
  return res.json()
}

// 手入力1件もExcel取り込み複数件も同じ口
export async function createAccountAuth(records: AccountAuthInput[]): Promise<{ inserted: number }> {
  const res = await fetch('/api/account-auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ records }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `追加に失敗しました (${res.status})`)
  }
  return res.json()
}

export async function updateAccountAuth(id: number, input: AccountAuthInput): Promise<AccountAuth> {
  const res = await fetch(`/api/account-auth/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `更新に失敗しました (${res.status})`)
  }
  return res.json()
}

export async function deleteAccountAuth(id: number): Promise<{ deleted: number }> {
  const res = await fetch(`/api/account-auth/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`削除に失敗しました (${res.status})`)
  return res.json()
}
