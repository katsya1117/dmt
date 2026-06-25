import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { parseAccountAuthExcel } from './parseExcel'

// ヘッダー＋行データから .xlsx の File を作る
async function makeXlsxFile(headers: string[], rows: (string | number)[][]): Promise<File> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Sheet1')
  ws.addRow(headers)
  rows.forEach((r) => ws.addRow(r))
  const buf = await wb.xlsx.writeBuffer()
  return new File([buf], 'test.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

describe('parseAccountAuthExcel', () => {
  it('日本語ヘッダーをフィールドにマッピングする', async () => {
    const file = await makeXlsxFile(
      ['アカウントID', '認証キー', '有効期限', '有効'],
      [['a001', 'KEY-1', '2027-03-31', '有効']]
    )
    const result = await parseAccountAuthExcel(file)
    expect(result).toEqual([
      { account_id: 'a001', auth_key: 'KEY-1', valid_until: '2027-03-31', enabled: 1 },
    ])
  })

  it('英語ヘッダーも受け付ける', async () => {
    const file = await makeXlsxFile(
      ['account_id', 'auth_key', 'valid_until', 'enabled'],
      [['a002', 'KEY-2', '2027-03-31', 0]]
    )
    const result = await parseAccountAuthExcel(file)
    expect(result[0].account_id).toBe('a002')
    expect(result[0].enabled).toBe(0)
  })

  it('「無効」を enabled=0 に正規化する', async () => {
    const file = await makeXlsxFile(['アカウントID', '認証キー', '有効'], [['a003', 'KEY-3', '無効']])
    const result = await parseAccountAuthExcel(file)
    expect(result[0].enabled).toBe(0)
  })

  it('有効列が未知の値なら既定で enabled=1', async () => {
    const file = await makeXlsxFile(['アカウントID', '認証キー', '有効'], [['a004', 'KEY-4', '']])
    const result = await parseAccountAuthExcel(file)
    expect(result[0].enabled).toBe(1)
  })

  it('account_id も auth_key も空の行は除外する', async () => {
    const file = await makeXlsxFile(
      ['アカウントID', '認証キー'],
      [['a005', 'KEY-5'], ['', '']]
    )
    const result = await parseAccountAuthExcel(file)
    expect(result).toHaveLength(1)
    expect(result[0].account_id).toBe('a005')
  })
})
