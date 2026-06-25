import ExcelJS from 'exceljs'
import type { AccountAuthInput } from '../../api/accountAuth'

// Excelのヘッダー名（日本語/英語どちらでも受け付ける）→ フィールドの対応
const HEADER_MAP: Record<string, keyof AccountAuthInput> = {
  'アカウントID': 'account_id',
  account_id: 'account_id',
  '認証キー': 'auth_key',
  auth_key: 'auth_key',
  '有効期限': 'valid_until',
  valid_until: 'valid_until',
  '有効': 'enabled',
  enabled: 'enabled',
}

/** セル値を文字列へ正規化（Date は YYYY-MM-DD に） */
function cellToString(value: unknown): string {
  if (value == null) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'object' && 'text' in (value as Record<string, unknown>)) {
    return String((value as { text: unknown }).text) // リッチテキスト等
  }
  return String(value)
}

/** .xlsx ファイルを読み、AccountAuthInput[] に変換する */
export async function parseAccountAuthExcel(file: File): Promise<AccountAuthInput[]> {
  const buf = await file.arrayBuffer()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf)
  const ws = wb.worksheets[0]
  if (!ws) return []

  // 1行目をヘッダーとして列番号→フィールド名の対応を作る
  const colToField: Record<number, keyof AccountAuthInput> = {}
  ws.getRow(1).eachCell((cell, col) => {
    const field = HEADER_MAP[cellToString(cell.value).trim()]
    if (field) colToField[col] = field
  })

  const result: AccountAuthInput[] = []
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return // ヘッダー行をスキップ
    const out: Partial<Record<keyof AccountAuthInput, unknown>> = {}
    for (const [colStr, field] of Object.entries(colToField)) {
      out[field] = row.getCell(Number(colStr)).value
    }
    const record: AccountAuthInput = {
      account_id: cellToString(out.account_id).trim(),
      auth_key: cellToString(out.auth_key).trim(),
      valid_until: out.valid_until ? cellToString(out.valid_until).trim() : null,
      enabled: normalizeEnabled(out.enabled),
    }
    if (record.account_id || record.auth_key) result.push(record) // 空行を除外
  })

  return result
}

function normalizeEnabled(v: unknown): number {
  if (v === 1 || v === '1' || v === true) return 1
  if (v === 0 || v === '0' || v === false) return 0
  const s = cellToString(v).trim()
  if (['有効', 'true', 'TRUE', '○', 'yes', 'Y'].includes(s)) return 1
  if (['無効', 'false', 'FALSE', '×', 'no', 'N'].includes(s)) return 0
  return 1 // 既定は有効
}
