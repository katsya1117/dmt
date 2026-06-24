import * as XLSX from 'xlsx'
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

/** .xlsx ファイルを読み、AccountAuthInput[] に変換する */
export async function parseAccountAuthExcel(file: File): Promise<AccountAuthInput[]> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf)
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

  return rows.map((row) => {
    const out: Record<string, unknown> = {}
    for (const [header, value] of Object.entries(row)) {
      const field = HEADER_MAP[header.trim()]
      if (field) out[field] = value
    }
    return {
      account_id: String(out.account_id ?? '').trim(),
      auth_key: String(out.auth_key ?? '').trim(),
      valid_until: out.valid_until ? String(out.valid_until).trim() : null,
      enabled: normalizeEnabled(out.enabled),
    }
  }).filter((r) => r.account_id || r.auth_key) // 空行を除外
}

function normalizeEnabled(v: unknown): number {
  if (v === 1 || v === '1' || v === true) return 1
  if (v === 0 || v === '0' || v === false) return 0
  const s = String(v).trim()
  if (['有効', 'true', 'TRUE', '○', 'yes', 'Y'].includes(s)) return 1
  if (['無効', 'false', 'FALSE', '×', 'no', 'N'].includes(s)) return 0
  return 1 // 既定は有効
}
