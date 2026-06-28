// ┌─────────────────────────────────────────────────────────────┐
// │ レイヤ: ルート（Expressのエンドポイント = サーバーの入口）     │
// │ 流れ:  HTTP → 【ここ】 → リポジトリ → DB                      │
// │                                                               │
// │ 役割: URLとHTTPメソッドを受け、入力を検証し、リポジトリを      │
// │       呼んで結果をJSONで返す。「DBをどう読むか」は知らない     │
// │       （それはリポジトリの仕事）。ここはHTTPの作法だけ担当。   │
// │  - GET    /        一覧                                        │
// │  - POST   /        追加（1件もExcel複数件も同じ口）           │
// │  - PUT    /:id     更新                                        │
// │  - DELETE /:id     削除                                        │
// └─────────────────────────────────────────────────────────────┘
import { Router } from 'express'
import {
  listAccountAuth,
  createAccountAuth,
  updateAccountAuth,
  deleteAccountAuth,
  type AccountAuthInput,
} from '../repositories/accountAuth'

const router = Router()

// 一覧
router.get('/', (_req, res) => {
  res.json(listAccountAuth())
})

// 追加（手入力1件もExcel取り込み複数件も、同じ口で受ける）
// body: { records: AccountAuthInput[] }
router.post('/', (req, res) => {
  const records = req.body?.records as AccountAuthInput[] | undefined
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'records（配列）が必要です' })
  }
  for (const r of records) {
    if (!r.account_id || !r.auth_key) {
      return res.status(400).json({ error: 'account_id と auth_key は必須です' })
    }
  }
  try {
    const result = createAccountAuth(records)
    res.status(201).json(result)
  } catch (e: unknown) {
    // UNIQUE制約違反など
    res.status(409).json({ error: e instanceof Error ? e.message : '追加に失敗しました' })
  }
})

// 更新
router.put('/:id', (req, res) => {
  const id = Number(req.params.id)
  const input = req.body as AccountAuthInput
  if (!input?.account_id || !input?.auth_key) {
    return res.status(400).json({ error: 'account_id と auth_key は必須です' })
  }
  try {
    const updated = updateAccountAuth(id, input)
    if (!updated) return res.status(404).json({ error: '対象が見つかりません' })
    res.json(updated)
  } catch (e: unknown) {
    res.status(409).json({ error: e instanceof Error ? e.message : '更新に失敗しました' })
  }
})

// 削除
router.delete('/:id', (req, res) => {
  const result = deleteAccountAuth(Number(req.params.id))
  if (result.deleted === 0) return res.status(404).json({ error: '対象が見つかりません' })
  res.json(result)
})

export default router
