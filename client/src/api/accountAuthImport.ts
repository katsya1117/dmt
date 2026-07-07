import type { components } from './generated/schema'
import { ApiError } from './error'
import type { AccountAuthInput } from './accountAuth'

// 差分の型はサーバーのtsoaコントローラ由来（OpenAPIから自動生成）
export type ImportDiff = components['schemas']['ImportDiff']
export type ChangedRow = components['schemas']['ChangedRow']

// 認証に関わる（事故ると客がログインできなくなる）項目。UIで強調する
export const AUTH_CRITICAL_FIELDS = ['username', 'password', 'delfg']

// 差分プレビュー（書き込みなし）。パース済みレコードを送って差分を受け取る
export async function previewImport(records: AccountAuthInput[]): Promise<ImportDiff> {
  const res = await fetch('/api/account-auth/import/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ records }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(res.status, body, (body.message ?? body.error ?? `差分計算に失敗しました (${res.status})`) as string)
  }
  return res.json()
}
