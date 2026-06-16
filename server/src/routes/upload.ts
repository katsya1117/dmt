import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import FormData from 'form-data'
import { config } from '../config'

const router = Router()

// 型式のファイルを顧客PHPサーバーへ転送
router.post('/:id', async (req, res) => {
  const { id } = req.params
  const katashikiDir = path.resolve(config.sambaPath, id)

  if (!fs.existsSync(katashikiDir)) {
    return res.status(404).json({ error: '型式フォルダが見つかりません' })
  }

  const files = fs.readdirSync(katashikiDir).filter((name) => {
    const ext = path.extname(name).toLowerCase().replace('.', '')
    return ext in config.resourceTypes
  })

  if (files.length === 0) {
    return res.status(400).json({ error: 'アップロード対象ファイルがありません' })
  }

  const form = new FormData()
  form.append('katashiki', id)
  for (const name of files) {
    form.append('files[]', fs.createReadStream(path.join(katashikiDir, name)), name)
  }

  const { default: fetch } = await import('node-fetch')
  const phpRes = await fetch(`${config.phpApiUrl}/api/upload.php`, {
    method: 'POST',
    body: form,
    headers: form.getHeaders(),
  })

  if (!phpRes.ok) {
    const text = await phpRes.text()
    return res.status(502).json({ error: 'PHPサーバーエラー', detail: text })
  }

  const result = await phpRes.json()
  return res.json(result)
})

export default router
