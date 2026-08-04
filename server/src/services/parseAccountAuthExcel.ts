import * as XLSX from 'xlsx'
import type { AccountAuthInput } from '../repositories/accountAuth'
import knownNumbers from '../data/accountAuthExcelKnownNumbers.json'

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
// 【2026-07-27にExcelJS→SheetJS(xlsx)へ移行】客先台帳に.xls（旧BIFF形式）も
// あることが判明したが、ExcelJSは.xlsxのみ対応で読めない。SheetJSは.xls/.xlsx
// 両対応のため、xls/xlsx で処理を分岐させず全面移行した。
// なおnpm registry公開の`xlsx`パッケージは2022年で更新停止し既知のHIGH脆弱性が
// 未修正のため、SheetJS公式配布のcdn.sheetjs.com経由（package.jsonのtarball URL
// 指定）でインストールしている。
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

// ─────────────────────────────────────────────────────────────
// 客先の台帳には、No.を欠番にした行を「←欠番」のような注記付きの結合セルで
// 表現している箇所がある。結合セルの値は左上端のセルにのみ入っており、
// 実際の客先ファイルではusername列が結合範囲の左上端に来るため、この注記が
// usernameとして誤って読み込まれ、実在しないアカウントとして登録されてしまう
// 危険がある（SheetJS移行後も同様。動作確認済み）。
//
// 【2026-07-14に一度撤去→2026-07-16復活】当初は自作テストファイル（結合範囲が
// username列まで及ぶ想定）のみで検証しており、実データ未検証のためYAGNIで
// 撤去していたが、実際の客先ファイルでもusername列まで結合が巻き込むことが
// 確認されたため復活させた（詳細はdocs/アカウント認証_Excel取り込み設計.md）。
//
// この番号の行は最初からデータとして取り込まない（No.ハードコード方式。
// 内容の文字列判定ではなく明示的なリストにすることで、想定外のデータを
// 誤って除外/混入させない）。
//
// 更新方法：コードではなく server/src/data/accountAuthExcelKnownNumbers.json の
// kessabanNumbers配列に対象No.を追加/削除するだけでよい（実行環境ごとに変わる
// 設定ではなく業務データのため、envではなく専用のJSONデータファイルに分離。
// 2026-07-16。client/src/data/の同名ファイルはMSWモック用の鏡なので、更新時は
// 両方揃えること）。実際のNo.は客先確認待ちで空の配列（TODO）
// ─────────────────────────────────────────────────────────────
const KESSABAN_NUMBERS: readonly number[] = knownNumbers.kessabanNumbers

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

/** アップロードされたxlsx/xlsバッファをパースし、AccountAuthInput[] に変換する */
export async function parseAccountAuthExcelBuffer(buffer: Buffer): Promise<AccountAuthInput[]> {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheetName = wb.SheetNames[0]
  const ws = sheetName ? wb.Sheets[sheetName] : undefined
  if (!ws || !ws['!ref']) return []

  const range = XLSX.utils.decode_range(ws['!ref'])
  const cellValue = (r: number, c: number): unknown => ws[XLSX.utils.encode_cell({ r, c })]?.v

  const colToField: Record<number, keyof AccountAuthInput> = {}
  let cancelDateCol: number | null = null
  for (let c = range.s.c; c <= range.e.c; c++) {
    const header = cellToString(cellValue(range.s.r, c)).trim()
    const field = HEADER_MAP[header]
    if (field) colToField[c] = field
    if (CANCEL_DATE_HEADERS.includes(header)) cancelDateCol = c
  }

  const records: AccountAuthInput[] = []
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const raw: Partial<Record<keyof AccountAuthInput, unknown>> = {}
    for (const [colStr, field] of Object.entries(colToField)) {
      raw[field] = cellValue(r, Number(colStr))
    }
    const hasCancelDate = cancelDateCol != null && cellToString(cellValue(r, cancelDateCol)).trim() !== ''
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
    const isKessaban = record.number != null && KESSABAN_NUMBERS.includes(record.number)
    if ((record.username || record.password) && !isKessaban) records.push(record) // 空行・欠番注記行を除外
  }

  return records
}
