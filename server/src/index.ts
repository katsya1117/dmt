import express, { type Request, type Response, type NextFunction } from 'express'
import cors from 'cors'
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

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

// ── 手書きルート（順次tsoaへ移行予定）──
app.use('/api/katashiki', katashikiRouter)
app.use('/api/upload', uploadRouter)
app.use('/api/jobs', jobsRouter)
app.use('/api/master', masterRouter)

// ── tsoa生成ルート（account-auth 他）──
// コントローラ(src/controllers)から `tsoa spec-and-routes` で生成。
RegisterRoutes(app)

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
    res.status(500).json({ message: 'サーバーエラー' })
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
