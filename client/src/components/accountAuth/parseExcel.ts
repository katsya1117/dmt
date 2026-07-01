import ExcelJS from 'exceljs'
import type { AccountAuthInput } from '../../api/accountAuth'

// Excelのヘッダー名（日本語/英語どちらでも）→ フィールドの対応
const HEADER_MAP: Record<string, keyof AccountAuthInput> = {
  'ユーザー名': 'username', username: 'username',
  'パスワード': 'password', password: 'password',
  '備考': 'comment', comment: 'comment',
  'No.': 'number', number: 'number',
  '申込日': 'submission_date', submission_date: 'submission_date',
  '登録日': 'regist_date', regist_date: 'regist_date',
  '販社CD': 'company_cd', company_cd: 'company_cd',
  '販売会社': 'company_name', company_name: 'company_name',
  '販売会社店舗CD': 'company_store_cd', company_store_cd: 'company_store_cd',
  '枝番': 'company_store_branch_num', company_store_branch_num: 'company_store_branch_num',
  '診断データ対象外': 'non_sync', non_sync: 'non_sync',
  '販売店CD': 'store_cd', store_cd: 'store_cd',
  '販売店名': 'store_name', store_name: 'store_name',
}

function cellToString(value: unknown): string {
  if (value == null) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'object' && 'text' in (value as Record<string, unknown>)) {
    return String((value as { text: unknown }).text)
  }
  return String(value)
}

function toBool(v: unknown): boolean {
  if (v === 1 || v === true) return true
  if (v === 0 || v === false || v == null) return false
  const s = cellToString(v).trim()
  return ['1', 'true', 'TRUE', '対象外', '○', 'yes', 'Y'].includes(s)
}

/** .xlsx ファイルを読み、AccountAuthInput[] に変換する */
export async function parseAccountAuthExcel(file: File): Promise<AccountAuthInput[]> {
  const buf = await file.arrayBuffer()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf)
  const ws = wb.worksheets[0]
  if (!ws) return []

  const colToField: Record<number, keyof AccountAuthInput> = {}
  ws.getRow(1).eachCell((cell, col) => {
    const field = HEADER_MAP[cellToString(cell.value).trim()]
    if (field) colToField[col] = field
  })

  const result: AccountAuthInput[] = []
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const raw: Partial<Record<keyof AccountAuthInput, unknown>> = {}
    for (const [colStr, field] of Object.entries(colToField)) {
      raw[field] = row.getCell(Number(colStr)).value
    }
    const orNull = (k: keyof AccountAuthInput): string | null => {
      const s = cellToString(raw[k]).trim()
      return s === '' ? null : s
    }
    const numText = cellToString(raw.number).trim()
    const record: AccountAuthInput = {
      username: cellToString(raw.username).trim(),
      password: cellToString(raw.password).trim(),
      comment: orNull('comment'),
      number: numText === '' ? null : Number(numText),
      submission_date: orNull('submission_date'),
      regist_date: orNull('regist_date'),
      company_cd: orNull('company_cd'),
      company_name: orNull('company_name'),
      company_store_cd: orNull('company_store_cd'),
      company_store_branch_num: orNull('company_store_branch_num'),
      non_sync: toBool(raw.non_sync),
      store_cd: orNull('store_cd'),
      store_name: orNull('store_name'),
      delfg: false, // Excel取り込みの新規は未削除
    }
    if (record.username || record.password) result.push(record) // 空行を除外
  })

  return result
}
