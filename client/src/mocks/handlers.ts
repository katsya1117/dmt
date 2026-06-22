import { http, HttpResponse, delay } from 'msw'
import { mockKatashikiList, mockKatashikiFiles } from './data'

export const handlers = [
  http.get('/api/katashiki', async () => {
    await delay(200)
    return HttpResponse.json(mockKatashikiList)
  }),

  http.get('/api/katashiki/:id/files', async ({ params }) => {
    await delay(200)
    const files = mockKatashikiFiles[params.id as string]
    if (!files) return HttpResponse.json({ error: '型式フォルダが見つかりません' }, { status: 404 })
    return HttpResponse.json(files)
  }),

  http.post('/api/upload/:id', async ({ params }) => {
    await delay(800)
    return HttpResponse.json({ success: true, message: `${params.id} のアップロードが完了しました` })
  }),
]
