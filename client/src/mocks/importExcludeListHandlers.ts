// ┌─────────────────────────────────────────────────────────────┐
// │ レイヤ: モック（MSW = Expressの代役）                          │
// │ Excel取り込みの差分除外Noリスト用CRUD。詳細は                 │
// │ docs/AMFPHP連携_差分除外リスト.md参照                          │
// └─────────────────────────────────────────────────────────────┘
import { http, HttpResponse, delay } from 'msw'
import type { ImportExcludeNumber } from '../api/importExcludeList'

const initialRows: ImportExcludeNumber[] = []

let rows: ImportExcludeNumber[] = structuredClone(initialRows)
let nextId = 1

export function resetImportExcludeNumbersMock() {
  rows = structuredClone(initialRows)
  nextId = 1
}

export const importExcludeListHandlers = [
  http.get('/api/account-auth/import/exclude-numbers', async () => {
    await delay(150)
    return HttpResponse.json(rows)
  }),

  http.post('/api/account-auth/import/exclude-numbers', async ({ request }) => {
    await delay(150)
    const body = (await request.json()) as { number?: number; comment?: string }
    const number = body.number
    if (typeof number !== 'number' || !Number.isInteger(number)) {
      return HttpResponse.json({ error: 'numberは整数で指定してください' }, { status: 400 })
    }
    rows.push({ id: nextId++, number, comment: body.comment ?? null })
    return HttpResponse.json(undefined, { status: 201 })
  }),

  http.delete('/api/account-auth/import/exclude-numbers/:id', async ({ params }) => {
    await delay(150)
    const id = Number(params.id)
    rows = rows.filter((r) => r.id !== id)
    return HttpResponse.json(undefined)
  }),
]
