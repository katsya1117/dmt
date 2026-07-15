// ┌─────────────────────────────────────────────────────────────┐
// │ レイヤ: モック（MSW = Expressの代役）                          │
// │ Storybook/テストで Express を起動せず、fetch を横取りして      │
// │ メモリ上の偽データで応答する。CRUD・論理削除も再現。           │
// └─────────────────────────────────────────────────────────────┘
import { http, HttpResponse, delay } from 'msw'
import type { AccountAuth, AccountAuthInput } from '../api/accountAuth'
import knownNumbers from '../data/accountAuthExcelKnownNumbers.json'
// 本番の取り込みはサーバー側パースに一本化した（server/src/services/
// parseAccountAuthExcel.ts 参照）が、MSWはブラウザのfetch/axiosを横取り
// するだけで実サーバーは立たないため、モック内ではこのクライアント側
// パーサーを使ってファイルをレコードに変換する
import { parseAccountAuthExcel } from '../components/accountAuth/parseExcel'

const ts = '2026-07-01 09:00:00'

const initialRows: AccountAuth[] = [
  {
    id: 1, username: 'dealer001', password: 'pw-001', comment: '東日本エリア', number: 1001,
    submission_date: '2024-04-01', regist_date: '2024-04-05',
    company_cd: 'C01', company_name: '北日本販売', company_store_cd: 'CS01', company_store_branch_num: '01',
    non_sync: false, store_cd: 'S001', store_name: '札幌中央店', reg_date: ts, upd_date: ts, delfg: false,
  },
  {
    id: 2, username: 'dealer002', password: 'pw-002', comment: null, number: 1002,
    submission_date: '2024-05-10', regist_date: '2024-05-12',
    company_cd: 'C02', company_name: '東日本販売', company_store_cd: 'CS02', company_store_branch_num: '03',
    non_sync: true, store_cd: 'S002', store_name: '仙台駅前店', reg_date: ts, upd_date: ts, delfg: false,
  },
  {
    id: 3, username: 'admin-honsha', password: 'pw-adm', comment: '本社管理', number: 9001,
    submission_date: null, regist_date: '2023-01-01',
    company_cd: 'C00', company_name: '本社', company_store_cd: null, company_store_branch_num: null,
    non_sync: false, store_cd: null, store_name: null, reg_date: ts, upd_date: ts, delfg: false,
  },
]

let rows: AccountAuth[] = structuredClone(initialRows)
let nextId = 4

export function resetAccountAuthMock() {
  rows = structuredClone(initialRows)
  nextId = 4
}

const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ')
const visible = () => rows.filter((r) => !r.delfg)

const IMPORT_FIELDS = [
  'username', 'password', 'comment', 'number', 'submission_date', 'regist_date',
  'company_cd', 'company_name', 'company_store_cd', 'company_store_branch_num',
  'non_sync', 'store_cd', 'store_name', 'delfg',
] as (keyof AccountAuthInput)[]

// アップロードされたFormDataから 'file' を取り出しレコード配列に変換する
async function extractRecords(request: Request): Promise<AccountAuthInput[]> {
  const formData = await request.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) return []
  return parseAccountAuthExcel(file)
}

// 客先の旧運用によるusername重複の既知レコード（No.で特定）。
// サーバー側 server/src/services/accountAuthDiff.ts の LEGACY_DUPLICATE_NUMBERS と同等。
// この配列はserver/src/data/accountAuthExcelKnownNumbers.jsonの鏡（MSWモック用）。
// 更新する時は両方揃えること
const LEGACY_DUPLICATE_NUMBERS: readonly number[] = knownNumbers.legacyDuplicateNumbers

function isKnownLegacyDuplicate(r: Pick<AccountAuthInput, 'number'>): boolean {
  return r.number != null && LEGACY_DUPLICATE_NUMBERS.includes(r.number)
}

export const accountAuthHandlers = [
  // 差分プレビュー（書き込みなし）。サーバーの diff ロジックと同等
  http.post('/api/account-auth/import/preview', async ({ request }) => {
    await delay(150)
    const records = await extractRecords(request)
    const byUsername = new Map(rows.map((r) => [r.username, r] as const))
    const byNumber = new Map(rows.filter((r) => r.number != null).map((r) => [r.number as number, r] as const))
    const added: AccountAuthInput[] = []
    const changed: { username: string; before: AccountAuth; after: AccountAuthInput; changedFields: string[] }[] = []
    const deleted: { username: string; before: AccountAuth; after: AccountAuthInput }[] = []
    const restored: { username: string; before: AccountAuth; after: AccountAuthInput }[] = []
    let unchangedCount = 0
    // usernameでdedupしない：同じusernameで複数のNo.が未マッチになりうるため、
    // No.（本来の一意キー）ごとにそのまま記録する（サーバー側と同じ考え方）
    const skippedDuplicateUsernames: { username: string; number: number | null }[] = []
    for (const r of records) {
      const legacy = isKnownLegacyDuplicate(r)
      // 既知のレガシー重複はusernameでは一意特定できないためNo.で照合する
      // （サーバー側 computeImportDiff と同じ考え方。詳細はそちらのコメント参照）
      const cur = legacy ? (r.number != null ? byNumber.get(r.number) : undefined) : byUsername.get(r.username)
      if (!cur) {
        if (legacy) { skippedDuplicateUsernames.push({ username: r.username, number: r.number }) } else { added.push(r) }
        continue
      }
      if (r.delfg && !cur.delfg) { deleted.push({ username: r.username, before: cur, after: r }); continue }
      if (!r.delfg && cur.delfg) { restored.push({ username: r.username, before: cur, after: r }); continue }
      const changedFields = IMPORT_FIELDS.filter(
        (f) => (r as Record<string, unknown>)[f] !== (cur as unknown as Record<string, unknown>)[f]
      )
      if (changedFields.length) changed.push({ username: r.username, before: cur, after: r, changedFields })
      else unchangedCount++
    }
    return HttpResponse.json({ added, changed, deleted, restored, unchangedCount, skippedDuplicateUsernames })
  }),

  // 適用（承認後）。preview と同じ突合ロジックで反映する
  http.post('/api/account-auth/import/apply', async ({ request }) => {
    await delay(150)
    const records = await extractRecords(request)

    // 検証: 必須欠け・ファイル内の「新規」重複（既知のレガシー重複と一致しないもの）
    // 行番号も記録する（usernameだけだと「ファイルの何行目同士が重複しているか」
    // 分からないため。サーバー側 accountAuthDiff.ts の validateImportRecords と同じ）
    const errors: string[] = []
    const firstSeenLine = new Map<string, number>()
    records.forEach((r, i) => {
      const line = i + 1
      if (!r.username) errors.push(`${line}行目：usernameが空です`)
      if (!r.password) errors.push(`${line}行目：passwordが空です`)
      if (isKnownLegacyDuplicate(r)) return
      if (r.username) {
        const first = firstSeenLine.get(r.username)
        if (first != null) {
          errors.push(`${line}行目：usernameが${first}行目と重複しています（新規の重複登録は許可されません）: ${r.username}`)
        } else {
          firstSeenLine.set(r.username, line)
        }
      }
    })
    if (errors.length > 0) {
      return HttpResponse.json({ error: '検証エラーがあります', errors }, { status: 400 })
    }

    const byUsername = new Map(rows.map((r) => [r.username, r] as const))
    const byNumber = new Map(rows.filter((r) => r.number != null).map((r) => [r.number as number, r] as const))
    let inserted = 0
    let updated = 0
    let deleted = 0
    let restored = 0
    for (const r of records) {
      const legacy = isKnownLegacyDuplicate(r)
      // 既知のレガシー重複はNo.でDB行を特定する（見つからなければ触らずスキップ）
      const cur = legacy ? (r.number != null ? byNumber.get(r.number) : undefined) : byUsername.get(r.username)
      if (!cur) {
        if (legacy) continue
        rows.push({ ...r, id: nextId++, reg_date: now(), upd_date: now() })
        inserted++
        continue
      }
      if (r.delfg && !cur.delfg) { cur.delfg = true; cur.upd_date = now(); deleted++; continue }
      if (!r.delfg && cur.delfg) { cur.delfg = false; cur.upd_date = now(); restored++; continue }
      const changedFields = IMPORT_FIELDS.filter(
        (f) => (r as Record<string, unknown>)[f] !== (cur as unknown as Record<string, unknown>)[f]
      )
      if (changedFields.length) {
        Object.assign(cur, r, { upd_date: now() })
        updated++
      }
    }
    return HttpResponse.json({ inserted, updated, deleted, restored })
  }),

  http.get('/api/account-auth', async ({ request }) => {
    await delay(150)
    const includeDeleted = new URL(request.url).searchParams.get('includeDeleted') === 'true'
    return HttpResponse.json(includeDeleted ? rows : visible())
  }),

  http.post('/api/account-auth', async ({ request }) => {
    await delay(150)
    const body = (await request.json()) as { records?: AccountAuthInput[] }
    const records = body.records ?? []
    if (records.length === 0) {
      return HttpResponse.json({ error: 'records（配列）が必要です' }, { status: 400 })
    }
    for (const r of records) {
      if (visible().some((x) => x.username === r.username)) {
        return HttpResponse.json({ error: `UNIQUE constraint failed: ${r.username}` }, { status: 409 })
      }
    }
    for (const r of records) {
      rows.push({ ...r, id: nextId++, reg_date: now(), upd_date: now() })
    }
    return HttpResponse.json({ inserted: records.length }, { status: 201 })
  }),

  http.put('/api/account-auth/:id', async ({ params, request }) => {
    await delay(150)
    const id = Number(params.id)
    const input = (await request.json()) as AccountAuthInput
    const idx = rows.findIndex((x) => x.id === id)
    if (idx === -1) return HttpResponse.json({ error: '対象が見つかりません' }, { status: 404 })
    rows[idx] = { ...rows[idx], ...input, id, upd_date: now() }
    return HttpResponse.json(rows[idx])
  }),

  http.delete('/api/account-auth/:id', async ({ params }) => {
    await delay(150)
    const id = Number(params.id)
    const target = rows.find((x) => x.id === id && !x.delfg)
    if (!target) return HttpResponse.json({ error: '対象が見つかりません' }, { status: 404 })
    target.delfg = true // 論理削除
    return HttpResponse.json({ deleted: 1 })
  }),
]
