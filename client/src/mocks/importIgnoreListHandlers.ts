// ┌─────────────────────────────────────────────────────────────┐
// │ レイヤ: モック（MSW = Expressの代役）                          │
// │ Excel取り込みの差分無視Noリスト用CRUD。詳細は                 │
// │ docs/AMFPHP連携_差分無視リスト.md参照                          │
// └─────────────────────────────────────────────────────────────┘
import { http, HttpResponse, delay } from 'msw'
import type { ImportIgnoreNumber } from '../api/importIgnoreList'

const initialRows: ImportIgnoreNumber[] = []

let rows: ImportIgnoreNumber[] = structuredClone(initialRows)
let nextId = 1

export function resetImportIgnoreNumbersMock() {
  rows = structuredClone(initialRows)
  nextId = 1
}

export const importIgnoreListHandlers = [
  http.get('/api/account-auth/import/ignore-numbers', async () => {
    await delay(150)
    return HttpResponse.json(rows)
  }),

  http.post('/api/account-auth/import/ignore-numbers', async ({ request }) => {
    await delay(150)
    const body = (await request.json()) as { number?: number; comment?: string }
    const number = body.number
    if (typeof number !== 'number' || !Number.isInteger(number)) {
      return HttpResponse.json({ error: 'numberは整数で指定してください' }, { status: 400 })
    }
    rows.push({ id: nextId++, number, comment: body.comment ?? null })
    return HttpResponse.json(undefined, { status: 201 })
  }),

  http.delete('/api/account-auth/import/ignore-numbers/:id', async ({ params }) => {
    await delay(150)
    const id = Number(params.id)
    rows = rows.filter((r) => r.id !== id)
    return HttpResponse.json(undefined)
  }),
]
