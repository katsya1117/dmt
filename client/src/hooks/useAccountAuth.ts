// ┌─────────────────────────────────────────────────────────────┐
// │ レイヤ: フック（サーバー状態の管理 = TanStack Query）          │
// │ 流れ:  画面 → 【ここ】 → API関数 → HTTP                       │
// │                                                               │
// │ 役割: 「取得・キャッシュ・ローディング・再取得」を引き受ける。 │
// │  - useQuery: 一覧を取得しキャッシュ（queryKey で識別）         │
// │  - useMutation: 追加/更新/削除。成功したら invalidate して     │
// │    一覧を自動で取り直す（画面側は再取得を意識しなくてよい）。  │
// │ 画面はこのフックを呼ぶだけで、データの出入りを気にしない。     │
// └─────────────────────────────────────────────────────────────┘
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchAccountAuthList,
  createAccountAuth,
  updateAccountAuth,
  deleteAccountAuth,
  type AccountAuthInput,
} from '../api/accountAuth'

// このデータを識別するキャッシュキー。invalidate でこのキーを無効化する
const KEY = ['account-auth']

export function useAccountAuthList() {
  return useQuery({ queryKey: KEY, queryFn: fetchAccountAuthList })
}

export function useAccountAuthMutations() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY })

  const create = useMutation({
    mutationFn: (records: AccountAuthInput[]) => createAccountAuth(records),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, input }: { id: number; input: AccountAuthInput }) => updateAccountAuth(id, input),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: number) => deleteAccountAuth(id),
    onSuccess: invalidate,
  })

  return { create, update, remove }
}
