import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { parseAccountAuthExcel } from './parseExcel'

async function makeXlsxFile(headers: string[], rows: (string | number)[][]): Promise<File> {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  return new File([buf], 'test.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

describe('parseAccountAuthExcel', () => {
  it('日本語ヘッダーをフィールドにマッピングする', async () => {
    const file = await makeXlsxFile(
      ['ユーザー名', 'パスワード', '販売会社', '診断データ対象外'],
      [['u001', 'pw1', '北日本販売', '対象外']]
    )
    const result = await parseAccountAuthExcel(file)
    expect(result).toHaveLength(1)
    expect(result[0].username).toBe('u001')
    expect(result[0].password).toBe('pw1')
    expect(result[0].company_name).toBe('北日本販売')
    expect(result[0].non_sync).toBe(true)
  })

  it('英語ヘッダーも受け付ける', async () => {
    const file = await makeXlsxFile(
      ['username', 'password', 'number', 'non_sync'],
      [['u002', 'pw2', 42, 0]]
    )
    const result = await parseAccountAuthExcel(file)
    expect(result[0].username).toBe('u002')
    expect(result[0].number).toBe(42)
    expect(result[0].non_sync).toBe(false)
  })

  it('未指定のnull可カラムは null になる', async () => {
    const file = await makeXlsxFile(['ユーザー名', 'パスワード'], [['u003', 'pw3']])
    const result = await parseAccountAuthExcel(file)
    expect(result[0].comment).toBeNull()
    expect(result[0].store_name).toBeNull()
    expect(result[0].number).toBeNull()
  })

  it('username も password も空の行は除外する', async () => {
    const file = await makeXlsxFile(
      ['ユーザー名', 'パスワード'],
      [['u004', 'pw4'], ['', '']]
    )
    const result = await parseAccountAuthExcel(file)
    expect(result).toHaveLength(1)
    expect(result[0].username).toBe('u004')
  })
})
