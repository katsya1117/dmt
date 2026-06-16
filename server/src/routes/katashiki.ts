import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { config } from '../config'

const router = Router()

// 型式一覧を返す（Sambaフォルダのサブディレクトリ名）
router.get('/', (_req, res) => {
  const sambaAbs = path.resolve(config.sambaPath)
  if (!fs.existsSync(sambaAbs)) {
    return res.status(503).json({ error: 'Sambaフォルダが見つかりません', path: sambaAbs })
  }

  const entries = fs.readdirSync(sambaAbs, { withFileTypes: true })
  const katashikiList = entries
    .filter((e) => e.isDirectory())
    .map((e) => ({ id: e.name, label: e.name }))

  return res.json(katashikiList)
})

// 型式別のアップロード対象ファイル一覧
router.get('/:id/files', (req, res) => {
  const katashikiDir = path.resolve(config.sambaPath, req.params.id)
  if (!fs.existsSync(katashikiDir)) {
    return res.status(404).json({ error: '型式フォルダが見つかりません' })
  }

  const files = fs
    .readdirSync(katashikiDir)
    .filter((name) => {
      const ext = path.extname(name).toLowerCase().replace('.', '')
      return ext in config.resourceTypes
    })
    .map((name) => {
      const ext = path.extname(name).toLowerCase().replace('.', '')
      return {
        name,
        ext,
        label: config.resourceTypes[ext]?.label ?? ext,
        size: fs.statSync(path.join(katashikiDir, name)).size,
      }
    })

  return res.json(files)
})

export default router
