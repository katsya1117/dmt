import type { Katashiki, KatashikiFile, UploadResult } from './types'

export async function fetchKatashikiList(): Promise<Katashiki[]> {
  const res = await fetch('/api/katashiki')
  if (!res.ok) throw new Error(`型式一覧の取得に失敗しました (${res.status})`)
  return res.json()
}

export async function fetchKatashikiFiles(id: string): Promise<KatashikiFile[]> {
  const res = await fetch(`/api/katashiki/${id}/files`)
  if (!res.ok) throw new Error(`ファイル一覧の取得に失敗しました (${res.status})`)
  return res.json()
}

export async function uploadKatashiki(id: string): Promise<UploadResult> {
  const res = await fetch(`/api/upload/${id}`, { method: 'POST' })
  if (!res.ok) throw new Error(`アップロードに失敗しました (${res.status})`)
  return res.json()
}
