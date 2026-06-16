import { Router } from 'express'

const router = Router()

// 処理A（VB）の呼び出し口 - 将来実装
router.post('/process-a', (_req, res) => {
  res.status(501).json({ message: '処理Aの呼び出しは未実装です' })
})

// 処理B（Python + Adobe）の呼び出し口 - 将来実装
router.post('/process-b', (_req, res) => {
  res.status(501).json({ message: '処理Bの呼び出しは未実装です' })
})

export default router
