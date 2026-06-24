import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useEffect } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import { RhfTextField } from '../form/RhfTextField'
import type { AccountAuth, AccountAuthInput } from '../../api/accountAuth'

const schema = z.object({
  account_id: z.string().min(1, 'アカウントIDは必須です'),
  auth_key: z.string().min(1, '認証キーは必須です'),
  valid_until: z.string().optional(),
  enabled: z.boolean(),
})
type FormValues = z.infer<typeof schema>

type Props = {
  open: boolean
  /** 編集対象。null なら新規追加 */
  target: AccountAuth | null
  onClose: () => void
  onSubmit: (input: AccountAuthInput) => void
  submitting?: boolean
}

const emptyValues: FormValues = { account_id: '', auth_key: '', valid_until: '', enabled: true }

export function AccountAuthFormDialog({ open, target, onClose, onSubmit, submitting }: Props) {
  const { control, handleSubmit, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyValues,
  })

  // ダイアログを開くたびに対象の値で初期化
  useEffect(() => {
    if (!open) return
    reset(
      target
        ? {
            account_id: target.account_id,
            auth_key: target.auth_key,
            valid_until: target.valid_until ?? '',
            enabled: target.enabled === 1,
          }
        : emptyValues
    )
  }, [open, target, reset])

  const submit = (v: FormValues) => {
    onSubmit({
      account_id: v.account_id,
      auth_key: v.auth_key,
      valid_until: v.valid_until || null,
      enabled: v.enabled ? 1 : 0,
    })
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{target ? 'アカウント認証の編集' : 'アカウント認証の新規追加'}</DialogTitle>
      <form onSubmit={handleSubmit(submit)}>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <RhfTextField name="account_id" control={control} label="アカウントID" size="small" fullWidth />
            <RhfTextField name="auth_key" control={control} label="認証キー" size="small" fullWidth />
            <RhfTextField
              name="valid_until"
              control={control}
              label="有効期限"
              type="date"
              size="small"
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <Controller
              name="enabled"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={<Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                  label="有効"
                />
              )}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>キャンセル</Button>
          <Button type="submit" variant="contained" disabled={submitting}>
            {target ? '更新' : '追加'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
