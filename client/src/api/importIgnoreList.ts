import type { components } from './generated/schema'
import { toApiError } from './error'
import { http } from './http'

export type ImportIgnoreNumber = components['schemas']['ImportIgnoreNumber']

const BASE_PATH = '/api/account-auth/import/ignore-numbers'

export async function fetchImportIgnoreNumbers(): Promise<ImportIgnoreNumber[]> {
  try {
    const res = await http.get<ImportIgnoreNumber[]>(BASE_PATH)
    return res.data
  } catch (err) {
    throw toApiError(err, '差分無視Noリストの取得に失敗しました')
  }
}

export async function addImportIgnoreNumber(number: number, comment?: string): Promise<void> {
  try {
    await http.post(BASE_PATH, { number, comment })
  } catch (err) {
    throw toApiError(err, '差分無視Noリストへの追加に失敗しました')
  }
}

export async function removeImportIgnoreNumber(id: number): Promise<void> {
  try {
    await http.delete(`${BASE_PATH}/${id}`)
  } catch (err) {
    throw toApiError(err, '差分無視Noリストからの削除に失敗しました')
  }
}
