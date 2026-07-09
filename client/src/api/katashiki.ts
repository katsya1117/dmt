import { http, axiosStatusOf } from './http'
import type { Katashiki, KatashikiFile, UploadResult } from './types'

export async function fetchKatashikiList(): Promise<Katashiki[]> {
  try {
    const res = await http.get<Katashiki[]>('/api/katashiki')
    return res.data
  } catch (err) {
    throw new Error(`型式一覧の取得に失敗しました (${axiosStatusOf(err)})`)
  }
}

export async function fetchKatashikiFiles(id: string): Promise<KatashikiFile[]> {
  try {
    const res = await http.get<KatashikiFile[]>(`/api/katashiki/${id}/files`)
    return res.data
  } catch (err) {
    throw new Error(`ファイル一覧の取得に失敗しました (${axiosStatusOf(err)})`)
  }
}

export async function uploadKatashiki(id: string): Promise<UploadResult> {
  try {
    const res = await http.post<UploadResult>(`/api/upload/${id}`)
    return res.data
  } catch (err) {
    throw new Error(`アップロードに失敗しました (${axiosStatusOf(err)})`)
  }
}
