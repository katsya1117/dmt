// ┌─────────────────────────────────────────────────────────────┐
// │ レイヤ: モック（MSW = Expressの代役）                          │
// │ Storybook/テストで Express を起動せず、fetch を横取りして      │
// │ メモリ上の偽データで応答する。CRUD・論理削除も再現。           │
// └─────────────────────────────────────────────────────────────┘
import { http, HttpResponse, delay } from 'msw'
import type { AccountAuth, AccountAuthInput } from '../api/accountAuth'
// 本番の取り込みはサーバー側パースに一本化した（server/src/services/
// parseAccountAuthExcel.ts 参照）が、MSWはブラウザのfetch/axiosを横取り
// するだけで実サーバーは立たないため、モック内ではこのクライアント側
// パーサーを使ってファイルをレコードに変換する
import { parseAccountAuthExcel } from '../components/accountAuth/parseExcel'

const ts = '2026-07-01 09:00:00'

// 【パスワードはハッシュ済みの値で持つ】実サーバー(server/src/db.ts)のシードも
// 平文を保存しないよう修正済みのため、モックのシードも平文(pw-001等)を直書き
// せずfakeHashPasswordを通す。画面に平文パスワードが一切表示されないという
// 実際の挙動をStorybookでも再現するため
const initialRows: AccountAuth[] = [
  {
    id: 1, accountName: 'dealer001', password: fakeHashPassword('pw-001'), comment: '東日本エリア', number: 1001,
    submission_date: '2024-04-01', regist_date: '2024-04-05',
    company_cd: 'C01', company_name: '北日本販売', company_store_cd: 'CS01', company_store_branch_num: '01',
    non_sync: false, store_cd: 'S001', store_name: '札幌中央店', reg_date: ts, upd_date: ts, delfg: false,
  },
  {
    id: 2, accountName: 'dealer002', password: fakeHashPassword('pw-002'), comment: null, number: 1002,
    submission_date: '2024-05-10', regist_date: '2024-05-12',
    company_cd: 'C02', company_name: '東日本販売', company_store_cd: 'CS02', company_store_branch_num: '03',
    non_sync: true, store_cd: 'S002', store_name: '仙台駅前店', reg_date: ts, upd_date: ts, delfg: false,
  },
  {
    id: 3, accountName: 'admin-honsha', password: fakeHashPassword('pw-adm'), comment: '本社管理', number: 9001,
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

// 【commentは含めない】備考欄はExcelから来るものではなく運用担当者が手動編集する
// ものなので、差分検知・上書きの対象にしない（サーバー側 accountAuthDiff.ts と同じ）
const IMPORT_FIELDS = [
  'accountName', 'password', 'number', 'submission_date', 'regist_date',
  'company_cd', 'company_name', 'company_store_cd', 'company_store_branch_num',
  'non_sync', 'store_cd', 'store_name', 'delfg',
] as (keyof AccountAuthInput)[]

const FIELD_LABELS: Partial<Record<keyof AccountAuthInput, string>> = {
  accountName: 'ユーザー名',
  number: 'No.',
  submission_date: '申込日',
  regist_date: '登録日',
  company_cd: '販社CD',
  company_name: '販売会社',
  company_store_cd: '販売会社店舗CD',
  company_store_branch_num: '店舗CD枝番',
  non_sync: '診断データ対象外',
  store_cd: '販売店CD',
  store_name: '販売店名',
}

function todayStr(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`
}

function formatValue(v: string | number | boolean | null): string {
  if (v === null || v === '') return '（空）'
  if (typeof v === 'boolean') return v ? 'ON' : 'OFF'
  return String(v)
}

// サーバー側 accountAuthDiff.ts の buildChangeComment と同じロジック
function buildChangeComment(changedFields: (keyof AccountAuthInput)[], before: AccountAuth, after: AccountAuthInput): string | null {
  const parts = changedFields
    .filter((f) => f !== 'password')
    .map((f) => `${FIELD_LABELS[f] ?? f}変更 ${formatValue(before[f])}→${formatValue(after[f])}`)
  if (changedFields.includes('password')) parts.push('パスワード変更')
  if (parts.length === 0) return null
  return `${todayStr()} ${parts.join('、')}`
}

function appendComment(existing: string | null, addition: string): string {
  return existing && existing.trim() !== '' ? `${existing} ${addition}` : addition
}

// アップロードされたFormDataから 'file' を取り出しレコード配列に変換する
async function extractRecords(formData: FormData): Promise<AccountAuthInput[]> {
  const file = formData.get('file')
  if (!(file instanceof File)) return []
  return parseAccountAuthExcel(file)
}

// commentOverrides（{ 行番号: 編集後の文字列 }のJSON文字列）を取り出す。
// サーバー側 accountAuthImportController.ts と同じ仕組み（詳細はそちらのコメント参照）
function extractCommentOverrides(formData: FormData): Record<number, string> {
  const raw = formData.get('commentOverrides')
  return typeof raw === 'string' ? JSON.parse(raw) : {}
}

// 【本物のMD5ではない】ブラウザで動くモック用の簡易版。実際のハッシュ化は
// サーバー側 server/src/repositories/accountAuth.ts でNode crypto(MD5)を使う。
// ここでは「平文をそのまま保存しない」という挙動をStorybook上で再現できれば十分
function fakeHashPassword(plain: string): string {
  let hash = 0
  for (let i = 0; i < plain.length; i++) hash = (hash * 31 + plain.charCodeAt(i)) | 0
  return `mockhash_${(hash >>> 0).toString(16)}`
}

// 検証: 必須欠け・「新規」accountName重複・No.重複。
// サーバー側 accountAuthDiff.ts の validateImportRecords と同じロジック
// （Excel取り込みpreview/apply・手動追加のcreate・更新update/リストアで共通して使う）。
// accountNameにDB UNIQUE制約は無い（客先の旧運用による重複が実在するため）ので、
// 重複拒否はこの関数だけが担う。existingNumbers/existingAccountNames を渡すと
// 「ファイル内」だけでなく「既存データとの重複」も同じロジックで検知できる。
// 【No.とaccountNameで一意性チェックの範囲が異なる】No.は削除済み含む全レコード
// で一意性を見る（過去に使われたNo.の再利用を防ぐ）。accountNameは「生きている
// 行（delfg=false）同士」でのみ行う（削除済みのaccountNameは再利用可という
// 客先の運用要望のため）。詳細はサーバー側参照
function validateImportRecords(
  records: AccountAuthInput[],
  existingNumbers: ReadonlySet<number> = new Set(),
  existingAccountNames: ReadonlySet<string> = new Set(),
): { line: number; number: number | null; message: string }[] {
  const errors: { line: number; number: number | null; message: string }[] = []
  // 「N行目」はユーザーにとって無意味（欠番注記行の除外でExcel上の実際の
  // 行位置とも一致しない）なので使わない。相手の行はNo./accountNameで示す
  const firstAccountNameForNumber = new Map<number, string>()
  const firstNumberLabelForAccountName = new Map<string, string>()
  for (const n of existingNumbers) firstAccountNameForNumber.set(n, '既存データ')
  for (const u of existingAccountNames) firstNumberLabelForAccountName.set(u, '既存データ')
  const numberLabel = (n: number | null) => (n != null ? `No.${n}` : 'No.未設定の行')
  records.forEach((r, i) => {
    const line = i + 1
    if (r.number == null) errors.push({ line, number: r.number, message: 'No.が設定されていません' })
    if (!r.accountName) errors.push({ line, number: r.number, message: `${numberLabel(r.number)}：accountNameが空です` })
    if (!r.password) errors.push({ line, number: r.number, message: `${numberLabel(r.number)}：passwordが空です` })
    // No.は削除済み行も含めて常にチェックする
    if (r.number != null) {
      const firstAccountName = firstAccountNameForNumber.get(r.number)
      if (firstAccountName != null) {
        errors.push({ line, number: r.number, message: `No.${r.number}が重複しています（同じNo.の行: ${firstAccountName}）` })
      } else {
        firstAccountNameForNumber.set(r.number, r.accountName || '（accountName未設定）')
      }
    }
    // accountName重複チェックだけは削除済み行を対象外にする
    if (r.delfg) return
    if (r.accountName) {
      const first = firstNumberLabelForAccountName.get(r.accountName)
      if (first != null) {
        errors.push({ line, number: r.number, message: `accountNameが重複しています（${first}と重複、新規の重複登録は許可されません）: ${r.accountName}` })
      } else {
        firstNumberLabelForAccountName.set(r.accountName, numberLabel(r.number))
      }
    }
  })
  return errors
}

// 手動追加・更新は常に1件だけの検証なので「No.X：」という前置きは自明で
// 冗長（フォーム上にNo.欄が見えている）。サーバー側 accountAuthDiff.ts の
// formatManualValidationMessage と同じロジック
function formatManualValidationMessage(error: { line: number; number: number | null; message: string }): string {
  return error.message.replace(/^No\.(\d+|未設定の行)：/, '')
}

export const accountAuthHandlers = [
  // 差分プレビュー（書き込みなし）。サーバーの diff ロジックと同等
  http.post('/api/account-auth/import/preview', async ({ request }) => {
    await delay(150)
    const records = await extractRecords(await request.formData())
    const byAccountName = new Map(rows.map((r) => [r.accountName, r] as const))
    const byNumber = new Map(rows.filter((r) => r.number != null).map((r) => [r.number as number, r] as const))
    const added: { line: number; record: AccountAuthInput }[] = []
    const changed: { line: number; accountName: string; before: AccountAuth; after: AccountAuthInput; changedFields: string[] }[] = []
    const deleted: { line: number; accountName: string; before: AccountAuth; after: AccountAuthInput }[] = []
    const restored: { line: number; accountName: string; before: AccountAuth; after: AccountAuthInput }[] = []
    let unchangedCount = 0
    records.forEach((r, i) => {
      const line = i + 1
      // No.を優先して照合する（サーバー側 accountAuthDiff.ts と同じ理由。
      // accountNameは削除後に再利用されうるため、accountNameだけだと間違ったDB行に
      // マッチする危険がある）
      const cur = r.number != null ? (byNumber.get(r.number) ?? byAccountName.get(r.accountName)) : byAccountName.get(r.accountName)
      if (!cur) {
        // 新規追加はExcelのcomment列を使わず常に空で始める
        added.push({ line, record: { ...r, comment: null } })
        return
      }
      if (r.delfg && !cur.delfg) {
        deleted.push({ line, accountName: r.accountName, before: cur, after: { ...r, comment: appendComment(cur.comment, `${todayStr()} 削除`) } })
        return
      }
      if (!r.delfg && cur.delfg) {
        restored.push({ line, accountName: r.accountName, before: cur, after: { ...r, comment: appendComment(cur.comment, `${todayStr()} 再登録`) } })
        return
      }
      // passwordはDBがハッシュ・Excelは平文なので、比較前にハッシュ化する
      // （サーバー側 accountAuthDiff.ts と同じ理由。単純比較だと常に「変更」扱いになる）
      const changedFields = IMPORT_FIELDS.filter((f) => {
        if (f === 'password') return fakeHashPassword(r.password) !== cur.password
        return (r as Record<string, unknown>)[f] !== (cur as unknown as Record<string, unknown>)[f]
      })
      if (changedFields.length) {
        const changeText = buildChangeComment(changedFields, cur, r)
        const after: AccountAuthInput = { ...r, comment: changeText ? appendComment(cur.comment, changeText) : cur.comment }
        changed.push({ line, accountName: r.accountName, before: cur, after, changedFields })
      } else unchangedCount++
    })
    const validationErrors = validateImportRecords(records)
    return HttpResponse.json({ added, changed, deleted, restored, unchangedCount, validationErrors })
  }),

  // 適用（承認後）。preview と同じ突合ロジックで反映する
  http.post('/api/account-auth/import/apply', async ({ request }) => {
    await delay(150)
    const formData = await request.formData()
    const records = await extractRecords(formData)
    const commentOverrides = extractCommentOverrides(formData)

    const errors = validateImportRecords(records)
    if (errors.length > 0) {
      return HttpResponse.json({ error: '検証エラーがあります', errors }, { status: 400 })
    }

    const byAccountName = new Map(rows.map((r) => [r.accountName, r] as const))
    const byNumber = new Map(rows.filter((r) => r.number != null).map((r) => [r.number as number, r] as const))
    let inserted = 0
    let updated = 0
    let deleted = 0
    let restored = 0
    records.forEach((r, i) => {
      const line = i + 1
      const cur = r.number != null ? (byNumber.get(r.number) ?? byAccountName.get(r.accountName)) : byAccountName.get(r.accountName)
      if (!cur) {
        // 新規追加はExcelのcomment列を使わず常に空で始める
        const comment = commentOverrides[line] ?? null
        rows.push({ ...r, password: fakeHashPassword(r.password), comment, id: nextId++, reg_date: now(), upd_date: now() })
        inserted++
        return
      }
      if (r.delfg && !cur.delfg) {
        cur.delfg = true
        cur.comment = commentOverrides[line] ?? appendComment(cur.comment, `${todayStr()} 削除`)
        cur.upd_date = now()
        deleted++
        return
      }
      if (!r.delfg && cur.delfg) {
        cur.delfg = false
        cur.comment = commentOverrides[line] ?? appendComment(cur.comment, `${todayStr()} 再登録`)
        cur.upd_date = now()
        restored++
        return
      }
      // passwordはDBがハッシュ・Excelは平文なので、比較前にハッシュ化する
      // （サーバー側 accountAuthDiff.ts と同じ理由。単純比較だと常に「変更」扱いになる）
      const changedFields = IMPORT_FIELDS.filter((f) => {
        if (f === 'password') return fakeHashPassword(r.password) !== cur.password
        return (r as Record<string, unknown>)[f] !== (cur as unknown as Record<string, unknown>)[f]
      })
      if (changedFields.length) {
        // Excel取り込みは常に平文パスワードが渡ってくる前提で毎回ハッシュ化する
        // （手動更新のような「空文字＝維持」の分岐は無い。サーバー側と同じ）
        const changeText = buildChangeComment(changedFields, cur, r)
        const comment = commentOverrides[line] ?? (changeText ? appendComment(cur.comment, changeText) : cur.comment)
        Object.assign(cur, r, { password: fakeHashPassword(r.password), comment, upd_date: now() })
        updated++
      }
    })
    return HttpResponse.json({ inserted, updated, deleted, restored })
  }),

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
    const existingNumbers = new Set(rows.map((r) => r.number).filter((n): n is number => n != null))
    const existingAccountNames = new Set(rows.filter((r) => !r.delfg).map((r) => r.accountName))
    const errors = validateImportRecords(records, existingNumbers, existingAccountNames)
    if (errors.length > 0) {
      return HttpResponse.json({ error: errors.map(formatManualValidationMessage).join(' / ') }, { status: 400 })
    }
    for (const r of records) {
      rows.push({ ...r, password: fakeHashPassword(r.password), id: nextId++, reg_date: now(), upd_date: now() })
    }
    return HttpResponse.json({ inserted: records.length }, { status: 201 })
  }),

  http.put('/api/account-auth/:id', async ({ params, request }) => {
    await delay(150)
    const id = Number(params.id)
    const input = (await request.json()) as AccountAuthInput
    const idx = rows.findIndex((x) => x.id === id)
    if (idx === -1) return HttpResponse.json({ error: '対象が見つかりません' }, { status: 404 })
    const current = rows[idx]
    // 空文字＝「パスワードを変更する」チェックOFF（クライアント側の規約）→既存ハッシュを維持
    const password = input.password.trim() === '' ? current.password : fakeHashPassword(input.password)
    // 更新後にdelfg=falseになる場合のみ、自分以外の生きているレコードとの重複を検証
    // （リストアも通常の編集も同じ扱い。検証は「実際に保存される値」で行う。
    // 詳細はサーバー側 accountAuthController.ts 参照）
    if (!input.delfg) {
      const others = rows.filter((r) => r.id !== id)
      const existingNumbers = new Set(others.map((r) => r.number).filter((n): n is number => n != null))
      const existingAccountNames = new Set(others.filter((r) => !r.delfg).map((r) => r.accountName))
      const errors = validateImportRecords([{ ...input, password }], existingNumbers, existingAccountNames)
      if (errors.length > 0) {
        return HttpResponse.json({ error: errors.map(formatManualValidationMessage).join(' / ') }, { status: 400 })
      }
    }
    rows[idx] = { ...rows[idx], ...input, password, id, upd_date: now() }
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
