import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { parseAccountAuthExcel } from './parseExcel'

// オブジェクト配列から .xlsx の File を作る
function makeXlsxFile(rows: Record<string, unknown>[]): File {
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return new File([buf], 'test.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

describe('parseAccountAuthExcel', () => {
  it('日本語ヘッダーをフィールドにマッピングする', async () => {
    const file = makeXlsxFile([
      { 'アカウントID': 'a001', '認証キー': 'KEY-1', '有効期限': '2027-03-31', '有効': '有効' },
    ])
    const result = await parseAccountAuthExcel(file)
    expect(result).toEqual([
      { account_id: 'a001', auth_key: 'KEY-1', valid_until: '2027-03-31', enabled: 1 },
    ])
  })

  it('英語ヘッダーも受け付ける', async () => {
    const file = makeXlsxFile([
      { account_id: 'a002', auth_key: 'KEY-2', valid_until: '2027-03-31', enabled: 0 },
    ])
    const result = await parseAccountAuthExcel(file)
    expect(result[0].account_id).toBe('a002')
    expect(result[0].enabled).toBe(0)
  })

  it('「無効」「×」などを enabled=0 に正規化する', async () => {
    const file = makeXlsxFile([
      { 'アカウントID': 'a003', '認証キー': 'KEY-3', '有効': '無効' },
    ])
    const result = await parseAccountAuthExcel(file)
    expect(result[0].enabled).toBe(0)
  })

  it('有効列が未知の値なら既定で enabled=1', async () => {
    const file = makeXlsxFile([
      { 'アカウントID': 'a004', '認証キー': 'KEY-4', '有効': '' },
    ])
    const result = await parseAccountAuthExcel(file)
    expect(result[0].enabled).toBe(1)
  })

  it('account_id も auth_key も空の行は除外する', async () => {
    const file = makeXlsxFile([
      { 'アカウントID': 'a005', '認証キー': 'KEY-5' },
      { 'アカウントID': '', '認証キー': '' },
    ])
    const result = await parseAccountAuthExcel(file)
    expect(result).toHaveLength(1)
    expect(result[0].account_id).toBe('a005')
  })
})
