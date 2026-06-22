import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '../mocks/server'
import { useKatashiki } from './useKatashiki'

describe('useKatashiki', () => {
  it('型式一覧を取得できる', async () => {
    const { result } = renderHook(() => useKatashiki())

    expect(result.current.status).toBe('loading')

    await waitFor(() => expect(result.current.status).toBe('success'))

    if (result.current.status === 'success') {
      expect(result.current.data).toHaveLength(3)
      expect(result.current.data[0]).toEqual({ id: 'ABC-2021', label: 'ABC-2021' })
    }
  })

  it('APIエラー時にerrorステータスになる', async () => {
    server.use(
      http.get('/api/katashiki', () =>
        HttpResponse.json({ error: 'サーバーエラー' }, { status: 500 })
      )
    )

    const { result } = renderHook(() => useKatashiki())

    await waitFor(() => expect(result.current.status).toBe('error'))

    if (result.current.status === 'error') {
      expect(result.current.message).toContain('500')
    }
  })
})
