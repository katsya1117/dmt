import { http, HttpResponse, delay } from 'msw'
import type { AccountAuth, AccountAuthInput } from '../api/accountAuth'

// Storybook/テスト上で実際にCRUDが反映されるよう、メモリ上に状態を持つ。
// resetAccountAuthMock() で初期状態に戻せる。
const initialRows: AccountAuth[] = [
  { id: 1, account_id: 'dealer001', auth_key: 'KEY-AB12-CD34', valid_until: '2027-03-31', enabled: 1, updated_at: '2026-06-25 08:03:57' },
  { id: 2, account_id: 'dealer002', auth_key: 'KEY-EF56-GH78', valid_until: '2027-03-31', enabled: 1, updated_at: '2026-06-25 08:03:57' },
  { id: 3, account_id: 'dealer003', auth_key: 'KEY-IJ90-KL12', valid_until: '2026-12-31', enabled: 0, updated_at: '2026-06-25 08:03:57' },
  { id: 4, account_id: 'admin-honsha', auth_key: 'KEY-MN34-OP56', valid_until: '2028-03-31', enabled: 1, updated_at: '2026-06-25 08:03:57' },
]

let rows: AccountAuth[] = structuredClone(initialRows)
let nextId = 5

export function resetAccountAuthMock() {
  rows = structuredClone(initialRows)
  nextId = 5
}

const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ')

export const accountAuthHandlers = [
  http.get('/api/account-auth', async () => {
    await delay(150)
    return HttpResponse.json(rows)
  }),

  http.post('/api/account-auth', async ({ request }) => {
    await delay(150)
    const body = (await request.json()) as { records?: AccountAuthInput[] }
    const records = body.records ?? []
    if (records.length === 0) {
      return HttpResponse.json({ error: 'records（配列）が必要です' }, { status: 400 })
    }
    for (const r of records) {
      if (!r.account_id || !r.auth_key) {
        return HttpResponse.json({ error: 'account_id と auth_key は必須です' }, { status: 400 })
      }
      if (rows.some((x) => x.account_id === r.account_id)) {
        return HttpResponse.json({ error: `UNIQUE constraint failed: ${r.account_id}` }, { status: 409 })
      }
    }
    for (const r of records) {
      rows.push({
        id: nextId++,
        account_id: r.account_id,
        auth_key: r.auth_key,
        valid_until: r.valid_until ?? null,
        enabled: r.enabled ?? 1,
        updated_at: now(),
      })
    }
    return HttpResponse.json({ inserted: records.length }, { status: 201 })
  }),

  http.put('/api/account-auth/:id', async ({ params, request }) => {
    await delay(150)
    const id = Number(params.id)
    const input = (await request.json()) as AccountAuthInput
    const idx = rows.findIndex((x) => x.id === id)
    if (idx === -1) return HttpResponse.json({ error: '対象が見つかりません' }, { status: 404 })
    rows[idx] = {
      ...rows[idx],
      account_id: input.account_id,
      auth_key: input.auth_key,
      valid_until: input.valid_until ?? null,
      enabled: input.enabled ?? 1,
      updated_at: now(),
    }
    return HttpResponse.json(rows[idx])
  }),

  http.delete('/api/account-auth/:id', async ({ params }) => {
    await delay(150)
    const id = Number(params.id)
    const before = rows.length
    rows = rows.filter((x) => x.id !== id)
    if (rows.length === before) return HttpResponse.json({ error: '対象が見つかりません' }, { status: 404 })
    return HttpResponse.json({ deleted: 1 })
  }),
]
