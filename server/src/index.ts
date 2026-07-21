import express, { type Request, type Response, type NextFunction } from 'express'
import cors from 'cors'
import multer from 'multer'
import swaggerUi from 'swagger-ui-express'
import { ValidateError } from 'tsoa'
import katashikiRouter from './routes/katashiki'
import uploadRouter from './routes/upload'
import jobsRouter from './routes/jobs'
import masterRouter from './routes/master'
import { RegisterRoutes } from './generated/routes'
import swaggerDocument from './generated/swagger.json'
import { config } from './config'

const app = express()

app.use(cors({ origin: 'http://localhost:3000' }))
// Excel取り込み（マスタ全件2万行規模）はJSONペイロードが数MBになるため、
// デフォルト上限(100kb)では即413/500になる。余裕を持って50mbに引き上げる
app.use(express.json({ limit: '50mb' }))

// ── 手書きルート（順次tsoaへ移行予定）──
app.use('/api/katashiki', katashikiRouter)
app.use('/api/upload', uploadRouter)
app.use('/api/jobs', jobsRouter)
app.use('/api/master', masterRouter)

// ── tsoa生成ルート（account-auth 他）──
// コントローラ(src/controllers)から `tsoa spec-and-routes` で生成。
// Excel取り込み（マスタ全件2万行規模）のファイルアップロードに対応するため
// multerの上限を50mbに引き上げる（tsoa.jsonのmulterOpts指定は非推奨のためここで渡す）
RegisterRoutes(app, { multer: multer({ limits: { fileSize: 50 * 1024 * 1024 } }) })

// ── Swagger UI（APIドキュメント・対話的テスト）──
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))

// ── tsoaのバリデーションエラーをJSONで返す ──
// @Body等の型に合わないリクエストは tsoa が ValidateError を投げる → 422で整形
app.use((err: unknown, _req: Request, res: Response, next: NextFunction): void => {
  if (err instanceof ValidateError) {
    res.status(422).json({ message: '入力値が不正です', details: err.fields })
    return
  }
  if (err instanceof Error) {
    console.error(err) // 原因不明の500を無言で握りつぶさない
    const status = (err as { status?: number; statusCode?: number }).status
      ?? (err as { statusCode?: number }).statusCode
      ?? 500
    res.status(status).json({ message: status === 413 ? 'アップロードデータが大きすぎます' : 'サーバーエラー' })
    return
  }
  next(err)
})

app.listen(config.port, () => {
  console.log(`Express server running on http://localhost:${config.port}`)
  console.log(`Swagger UI:  http://localhost:${config.port}/api-docs`)
  console.log(`Samba path: ${config.sambaPath}`)
  console.log(`PHP API:    ${config.phpApiUrl}`)
})
