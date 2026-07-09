import ExcelJS from 'exceljs'
import type { AccountAuthInput } from '../../api/accountAuth'

// ─────────────────────────────────────────────────────────────
// 【本番の取り込みフローでは使われていません】
// 2026-07-10計測：20000行規模のExcelをこの関数でパースすると、ブラウザの
// メインスレッドが約10.7秒ブロックされることを実測で確認した。そのため
// 実運用のパースはサーバー側ストリーミング（server/src/services/
// parseAccountAuthExcelStream.ts）に一本化し、AccountAuthTable.tsx から
// この関数は呼ばなくなった。
//
// このファイルを消さずに残しているのは、client/src/mocks/accountAuthHandlers.ts
// （Storybook/vitestのMSWモック）が引き続きこれを使ってファイルをパースして
// いるため（MSWはfetchを横取りするだけで実Expressサーバーを起動しないので、
// サーバー側の実装を呼べない）。変換ルール（ヘッダー対応・解約日列の扱い等）を
// 変更する際は、こちらとサーバー側の parseAccountAuthExcelStream.ts の
// 両方を直すこと。
// ─────────────────────────────────────────────────────────────

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
  '削除フラグ': 'delfg', delfg: 'delfg',
}

// 客先支給の台帳には0/1の削除フラグ列が無く、「解約日」列に日付が入っている行が
// 削除（論理削除）扱い（客先側では行を赤塗りして運用している）。この列に値があれば
// 削除フラグ列の有無に関わらず delfg=true とする
const CANCEL_DATE_HEADERS = ['解約日', 'cancel_date', 'cancellation_date']

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
  let cancelDateCol: number | null = null
  ws.getRow(1).eachCell((cell, col) => {
    const header = cellToString(cell.value).trim()
    const field = HEADER_MAP[header]
    if (field) colToField[col] = field
    if (CANCEL_DATE_HEADERS.includes(header)) cancelDateCol = col
  })

  const result: AccountAuthInput[] = []
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const raw: Partial<Record<keyof AccountAuthInput, unknown>> = {}
    for (const [colStr, field] of Object.entries(colToField)) {
      raw[field] = row.getCell(Number(colStr)).value
    }
    const hasCancelDate = cancelDateCol != null && cellToString(row.getCell(cancelDateCol).value).trim() !== ''
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
      delfg: toBool(raw.delfg) || hasCancelDate, // 「削除フラグ」列 or 「解約日」列に値があれば削除扱い
    }
    if (record.username || record.password) result.push(record) // 空行を除外
  })

  return result
}
