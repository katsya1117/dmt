// ┌─────────────────────────────────────────────────────────────┐
// │ レイヤ: モック（MSW = Expressの代役）                          │
// │ Excel取り込みの比較前値置換ルール用CRUD。詳細は               │
// │ docs/Excel取り込み_比較前値置換ルール.md参照                   │
// └─────────────────────────────────────────────────────────────┘
import { http, HttpResponse, delay } from 'msw'
import type { ImportValueNormalizeRule } from '../api/importValueNormalizeRules'

const initialRows: ImportValueNormalizeRule[] = []

let rows: ImportValueNormalizeRule[] = structuredClone(initialRows)
let nextId = 1

export function resetImportValueNormalizeRulesMock() {
  rows = structuredClone(initialRows)
  nextId = 1
}

export const importValueNormalizeRulesHandlers = [
  http.get('/api/account-auth/import/normalize-rules', async () => {
    await delay(150)
    return HttpResponse.json(rows)
  }),

  http.post('/api/account-auth/import/normalize-rules', async ({ request }) => {
    await delay(150)
    const body = (await request.json()) as { field?: string; fromValue?: string; toValue?: string }
    if (!body.field || !body.fromValue || !body.toValue) {
      return HttpResponse.json({ error: 'field/fromValue/toValueは必須です' }, { status: 400 })
    }
    rows.push({ id: nextId++, field: body.field, fromValue: body.fromValue, toValue: body.toValue })
    return HttpResponse.json(undefined, { status: 201 })
  }),

  http.delete('/api/account-auth/import/normalize-rules/:id', async ({ params }) => {
    await delay(150)
    const id = Number(params.id)
    rows = rows.filter((r) => r.id !== id)
    return HttpResponse.json(undefined)
  }),
]
