import express from 'express'
import cors from 'cors'
import katashikiRouter from './routes/katashiki'
import uploadRouter from './routes/upload'
import jobsRouter from './routes/jobs'
import { config } from './config'

const app = express()

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

app.use('/api/katashiki', katashikiRouter)
app.use('/api/upload', uploadRouter)
app.use('/api/jobs', jobsRouter)

app.listen(config.port, () => {
  console.log(`Express server running on http://localhost:${config.port}`)
  console.log(`Samba path: ${config.sambaPath}`)
  console.log(`PHP API:    ${config.phpApiUrl}`)
})
