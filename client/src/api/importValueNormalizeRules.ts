import type { components } from './generated/schema'
import { toApiError } from './error'
import { http } from './http'

export type ImportValueNormalizeRule = components['schemas']['ImportValueNormalizeRule']

const BASE_PATH = '/api/account-auth/import/normalize-rules'

export async function fetchImportValueNormalizeRules(): Promise<ImportValueNormalizeRule[]> {
  try {
    const res = await http.get<ImportValueNormalizeRule[]>(BASE_PATH)
    return res.data
  } catch (err) {
    throw toApiError(err, '比較前値置換ルールの取得に失敗しました')
  }
}

export async function addImportValueNormalizeRule(
  field: string,
  fromValue: string,
  toValue: string,
): Promise<void> {
  try {
    await http.post(BASE_PATH, { field, fromValue, toValue })
  } catch (err) {
    throw toApiError(err, '比較前値置換ルールの追加に失敗しました')
  }
}

export async function removeImportValueNormalizeRule(id: number): Promise<void> {
  try {
    await http.delete(`${BASE_PATH}/${id}`)
  } catch (err) {
    throw toApiError(err, '比較前値置換ルールの削除に失敗しました')
  }
}
