import type { components } from './generated/schema'
import { toApiError } from './error'
import { http } from './http'

export type ImportExcludeNumber = components['schemas']['ImportExcludeNumber']

const BASE_PATH = '/api/account-auth/import/exclude-numbers'

export async function fetchImportExcludeNumbers(): Promise<ImportExcludeNumber[]> {
  try {
    const res = await http.get<ImportExcludeNumber[]>(BASE_PATH)
    return res.data
  } catch (err) {
    throw toApiError(err, '差分除外Noリストの取得に失敗しました')
  }
}

export async function addImportExcludeNumber(number: number, comment?: string): Promise<void> {
  try {
    await http.post(BASE_PATH, { number, comment })
  } catch (err) {
    throw toApiError(err, '差分除外Noリストへの追加に失敗しました')
  }
}

export async function removeImportExcludeNumber(id: number): Promise<void> {
  try {
    await http.delete(`${BASE_PATH}/${id}`)
  } catch (err) {
    throw toApiError(err, '差分除外Noリストからの削除に失敗しました')
  }
}
