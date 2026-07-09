import ExcelJS from 'exceljs'
import type { AccountAuthInput } from '../repositories/accountAuth'

// ─────────────────────────────────────────────────────────────
// Excel取り込みのパース（サーバー側）。
// クライアント側 parseAccountAuthExcel（client/src/components/accountAuth/
// parseExcel.ts）と同じ変換ルールをサーバー側に移植したもの。
// 2026-07-10計測：20000行をクライアント側(exceljs Workbook.xlsx.load)で
// パースするとブラウザのメインスレッドが約10.7秒ブロックされたため、
// マスタ全件(2万行規模)を扱う本番導線はこちらに一本化した。
// クライアント側の parseExcel.ts はテスト/Storybookのモックからは
// 引き続き使われている（実運用のパースはここに一本化）。
//
// 【ストリーミングAPIは不採用】当初 ExcelJS.stream.xlsx.WorkbookReader
// （1行ずつのストリーム読み）で実装したが、同一バイト列のファイルでも
// 再現性のある形で "Cannot read properties of undefined (reading 'sheets')"
// で落ちる現象を確認した（workbook.xmlの解析がworksheetエントリの処理より
// 後に完了するケースがあるexceljs側の既知の不安定さと見られる。一時ファイル
// 経由に変えても再現した）。目的は「ブラウザを固まらせない」ことであり、
// サーバー側でNodeのイベントループを数百ms〜1秒止めること自体は、この
// 内部ツール（同時に取り込み操作をするのは実質1人）では許容範囲と判断し、
// 安定している非ストリーミングAPI（Workbook.xlsx.load、フルパース）を採用。
// 実測：20000行で478ms。
// ─────────────────────────────────────────────────────────────

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

/** アップロードされたxlsxバッファをパースし、AccountAuthInput[] に変換する */
export async function parseAccountAuthExcelBuffer(buffer: Buffer): Promise<AccountAuthInput[]> {
  const wb = new ExcelJS.Workbook()
  // exceljsの型定義が古いBuffer型を想定しており@types/nodeのBuffer<ArrayBufferLike>と
  // 噛み合わない（実行時は問題ない型のみのミスマッチ）。anyを介して逃がす
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(buffer as any)
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

  const records: AccountAuthInput[] = []
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
      delfg: toBool(raw.delfg) || hasCancelDate,
    }
    if (record.username || record.password) records.push(record) // 空行を除外
  })

  return records
}
