import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchAccountAuthList,
  createAccountAuth,
  updateAccountAuth,
  deleteAccountAuth,
  type AccountAuthInput,
} from '../api/accountAuth'

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
