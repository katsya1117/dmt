import type { components } from './generated/schema'
import { toApiError } from './error'
import { http } from './http'

// 差分の型はサーバーのtsoaコントローラ由来（OpenAPIから自動生成）
export type ImportDiff = components['schemas']['ImportDiff']
export type ChangedRow = components['schemas']['ChangedRow']
export type ApplyImportResult = components['schemas']['ApplyImportResult']

// 認証に関わる（事故ると客がログインできなくなる）項目。UIで強調する
export const AUTH_CRITICAL_FIELDS = ['username', 'password', 'delfg']

// パースはサーバー側で行う（ファイルをそのままアップロード）。
// 2026-07-10計測：20000行規模をクライアント側でパースするとブラウザの
// メインスレッドが約10.7秒ブロックされたため、マスタ全件・差分ファイル
// どちらもサーバー側パースに一本化した。

// 差分プレビュー（書き込みなし）
export async function previewImport(file: File): Promise<ImportDiff> {
  const formData = new FormData()
  formData.append('file', file)
  try {
    const res = await http.post<ImportDiff>('/api/account-auth/import/preview', formData)
    return res.data
  } catch (err) {
    throw toApiError(err, '差分計算に失敗しました')
  }
}

// 差分を承認後に適用。サーバー側でDBを再読込→差分を再計算してから反映する
export async function applyImport(file: File): Promise<ApplyImportResult> {
  const formData = new FormData()
  formData.append('file', file)
  try {
    const res = await http.post<ApplyImportResult>('/api/account-auth/import/apply', formData)
    return res.data
  } catch (err) {
    throw toApiError(err, '適用に失敗しました')
  }
}
