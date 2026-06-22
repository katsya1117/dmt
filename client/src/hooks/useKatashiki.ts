import { useState, useEffect } from 'react'
import { fetchKatashikiList } from '../api/katashiki'
import type { Katashiki } from '../api/types'

type State =
  | { status: 'loading' }
  | { status: 'success'; data: Katashiki[] }
  | { status: 'error'; message: string }

export function useKatashiki(): State {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })

    fetchKatashikiList()
      .then((data) => { if (!cancelled) setState({ status: 'success', data }) })
      .catch((e: unknown) => {
        if (!cancelled) setState({ status: 'error', message: e instanceof Error ? e.message : '不明なエラー' })
      })

    return () => { cancelled = true }
  }, [])

  return state
}
