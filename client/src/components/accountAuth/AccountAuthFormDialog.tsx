import { useForm, Controller, type Path } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useEffect, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import Alert from '@mui/material/Alert'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import { RhfTextField } from '../form/RhfTextField'
import type { AccountAuth, AccountAuthInput } from '../../api/accountAuth'
import { toFieldErrors } from '../../api/error'

const schema = z.object({
  username: z.string().min(1, 'ユーザー名は必須です'),
  password: z.string().min(1, 'パスワードは必須です'),
  comment: z.string(),
  number: z.string(), // 数値テキスト。空→null、値→number に変換
  submission_date: z.string(),
  regist_date: z.string(),
  company_cd: z.string(),
  company_name: z.string(),
  company_store_cd: z.string(),
  company_store_branch_num: z.string(),
  non_sync: z.boolean(),
  store_cd: z.string(),
  store_name: z.string(),
})
type FormValues = z.infer<typeof schema>

const empty: FormValues = {
  username: '', password: '', comment: '', number: '', submission_date: '', regist_date: '',
  company_cd: '', company_name: '', company_store_cd: '', company_store_branch_num: '',
  non_sync: false, store_cd: '', store_name: '',
}

type Props = {
  open: boolean
  /** 編集対象。null なら新規追加 */
  target: AccountAuth | null
  onClose: () => void
  /** 送信。失敗時は ApiError を throw する想定（フィールドエラー紐付けのため await する） */
  onSubmit: (input: AccountAuthInput) => Promise<void>
  /** 送信成功時（ダイアログを閉じる等は呼び出し側） */
  onSuccess: () => void
  submitting?: boolean
}

// 空文字 → null（書き込み型は null可カラムを `| null` で表現）
const orNull = (s: string): string | null => (s.trim() === '' ? null : s)

export function AccountAuthFormDialog({ open, target, onClose, onSubmit, onSuccess, submitting }: Props) {
  const { control, handleSubmit, reset, setError } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: empty,
    mode: 'onTouched', // 触った項目から順にリアルタイム検証（世の中の標準的な体感）
  })
  // どのフォーム項目にも紐付かないサーバーエラー（通信断・500等）はここに出す
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setFormError(null)
    reset(
      target
        ? {
            username: target.username,
            password: target.password,
            comment: target.comment ?? '',
            number: target.number != null ? String(target.number) : '',
            submission_date: target.submission_date ?? '',
            regist_date: target.regist_date ?? '',
            company_cd: target.company_cd ?? '',
            company_name: target.company_name ?? '',
            company_store_cd: target.company_store_cd ?? '',
            company_store_branch_num: target.company_store_branch_num ?? '',
            non_sync: target.non_sync,
            store_cd: target.store_cd ?? '',
            store_name: target.store_name ?? '',
          }
        : empty
    )
  }, [open, target, reset])

  // フォーム上のフィールド名（サーバーエラーをこの集合だけ項目に紐付ける）
  const FIELD_NAMES = new Set(Object.keys(empty))

  const submit = async (v: FormValues) => {
    setFormError(null)
    try {
      await onSubmit({
        username: v.username,
        password: v.password,
        comment: orNull(v.comment),
        number: v.number.trim() === '' ? null : Number(v.number),
        submission_date: orNull(v.submission_date),
        regist_date: orNull(v.regist_date),
        company_cd: orNull(v.company_cd),
        company_name: orNull(v.company_name),
        company_store_cd: orNull(v.company_store_cd),
        company_store_branch_num: orNull(v.company_store_branch_num),
        non_sync: v.non_sync,
        store_cd: orNull(v.store_cd),
        store_name: orNull(v.store_name),
      })
      onSuccess()
    } catch (err) {
      // サーバーエラーを「項目下の赤字」へ。紐付かないものは上部Alertへ。
      const fieldErrors = toFieldErrors(err)
      const mapped = Object.entries(fieldErrors).filter(([f]) => FIELD_NAMES.has(f))
      if (mapped.length > 0) {
        mapped.forEach(([f, message]) => setError(f as Path<FormValues>, { type: 'server', message }))
      } else {
        setFormError(err instanceof Error ? err.message : '保存に失敗しました')
      }
    }
  }

  const half = { xs: 12, sm: 6 } as const
  const shrink = { inputLabel: { shrink: true } }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{target ? 'アカウント認証の編集' : 'アカウント認証の新規追加'}</DialogTitle>
      <form onSubmit={handleSubmit(submit)}>
        <DialogContent>
          {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid size={half}><RhfTextField name="username" control={control} label="ユーザー名" size="small" fullWidth /></Grid>
            <Grid size={half}><RhfTextField name="password" control={control} label="パスワード" size="small" fullWidth /></Grid>
            <Grid size={half}><RhfTextField name="number" control={control} label="No." type="number" size="small" fullWidth /></Grid>
            <Grid size={half}>
              <Controller name="non_sync" control={control} render={({ field }) => (
                <FormControlLabel
                  control={<Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                  label="診断データ対象外"
                />
              )} />
            </Grid>
            <Grid size={half}><RhfTextField name="submission_date" control={control} label="申込日" type="date" size="small" fullWidth slotProps={shrink} /></Grid>
            <Grid size={half}><RhfTextField name="regist_date" control={control} label="登録日" type="date" size="small" fullWidth slotProps={shrink} /></Grid>
            <Grid size={half}><RhfTextField name="company_cd" control={control} label="販社CD" size="small" fullWidth /></Grid>
            <Grid size={half}><RhfTextField name="company_name" control={control} label="販売会社" size="small" fullWidth /></Grid>
            <Grid size={half}><RhfTextField name="company_store_cd" control={control} label="販売会社店舗CD" size="small" fullWidth /></Grid>
            <Grid size={half}><RhfTextField name="company_store_branch_num" control={control} label="店舗CD枝番" size="small" fullWidth /></Grid>
            <Grid size={half}><RhfTextField name="store_cd" control={control} label="販売店CD" size="small" fullWidth /></Grid>
            <Grid size={half}><RhfTextField name="store_name" control={control} label="販売店名" size="small" fullWidth /></Grid>
            <Grid size={12}><RhfTextField name="comment" control={control} label="備考" size="small" fullWidth multiline minRows={2} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>キャンセル</Button>
          <Button type="submit" variant="contained" disabled={submitting}>{target ? '更新' : '追加'}</Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
