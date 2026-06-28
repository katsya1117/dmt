// ┌─────────────────────────────────────────────────────────────┐
// │ レイヤ: 画面（ページコンポーネント = フローの出発点）          │
// │ 流れ:  【ここ】 → フック → API関数 → HTTP → Express(or MSW)   │
// │                                                               │
// │ 役割: 見た目と操作だけに集中する。データ取得・送信は           │
// │       useAccountAuth* フックに任せ、自分は fetch を一切書かない。│
// │  - 一覧表示      : useAccountAuthList() の data を並べる        │
// │  - 追加/更新/削除: useAccountAuthMutations() を呼ぶ            │
// │  - 画面固有の状態(ダイアログ開閉・選択行・トースト)だけ useState│
// └─────────────────────────────────────────────────────────────┘
import { useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import { useAccountAuthList, useAccountAuthMutations } from '../hooks/useAccountAuth'
import { AccountAuthFormDialog } from '../components/accountAuth/AccountAuthFormDialog'
import { parseAccountAuthExcel } from '../components/accountAuth/parseExcel'
import type { AccountAuth, AccountAuthInput } from '../api/accountAuth'

export default function AccountAuthTable() {
  const { data, isLoading, error } = useAccountAuthList()
  const { create, update, remove } = useAccountAuthMutations()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<AccountAuth | null>(null)
  const [toast, setToast] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const openAdd = () => { setEditTarget(null); setDialogOpen(true) }
  const openEdit = (row: AccountAuth) => { setEditTarget(row); setDialogOpen(true) }

  const handleSubmit = (input: AccountAuthInput) => {
    if (editTarget) {
      update.mutate(
        { id: editTarget.id, input },
        {
          onSuccess: () => { setDialogOpen(false); setToast({ msg: '更新しました', severity: 'success' }) },
          onError: (e) => setToast({ msg: (e as Error).message, severity: 'error' }),
        }
      )
    } else {
      create.mutate([input], {
        onSuccess: () => { setDialogOpen(false); setToast({ msg: '追加しました', severity: 'success' }) },
        onError: (e) => setToast({ msg: (e as Error).message, severity: 'error' }),
      })
    }
  }

  const handleDelete = (row: AccountAuth) => {
    if (!confirm(`「${row.account_id}」を削除しますか？`)) return
    remove.mutate(row.id, {
      onSuccess: () => setToast({ msg: '削除しました', severity: 'success' }),
      onError: (e) => setToast({ msg: (e as Error).message, severity: 'error' }),
    })
  }

  const handleExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const records = await parseAccountAuthExcel(file)
      if (records.length === 0) { setToast({ msg: '取り込める行がありませんでした', severity: 'error' }); return }
      create.mutate(records, {
        onSuccess: (r) => setToast({ msg: `${r.inserted}件を取り込みました`, severity: 'success' }),
        onError: (err) => setToast({ msg: (err as Error).message, severity: 'error' }),
      })
    } catch {
      setToast({ msg: 'Excelの読み込みに失敗しました', severity: 'error' })
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h1" gutterBottom>アカウント認証テーブル</Typography>

      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>新規追加</Button>
        <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => fileRef.current?.click()}>
          Excel取り込み
        </Button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={handleExcel} />
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{(error as Error).message}</Alert>}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>アカウントID</TableCell>
              <TableCell>認証キー</TableCell>
              <TableCell>有効期限</TableCell>
              <TableCell>有効</TableCell>
              <TableCell>更新日時</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={7}>読み込み中...</TableCell></TableRow>
            )}
            {!isLoading && data?.length === 0 && (
              <TableRow><TableCell colSpan={7}>データがありません</TableCell></TableRow>
            )}
            {data?.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell>{row.id}</TableCell>
                <TableCell>{row.account_id}</TableCell>
                <TableCell>{row.auth_key}</TableCell>
                <TableCell>{row.valid_until ?? '—'}</TableCell>
                <TableCell>
                  <Chip label={row.enabled ? '有効' : '無効'} color={row.enabled ? 'primary' : 'default'} size="small" />
                </TableCell>
                <TableCell>{row.updated_at}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => openEdit(row)} aria-label="編集"><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" onClick={() => handleDelete(row)} aria-label="削除"><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <AccountAuthFormDialog
        open={dialogOpen}
        target={editTarget}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        submitting={create.isPending || update.isPending}
      />

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {toast ? <Alert severity={toast.severity} onClose={() => setToast(null)}>{toast.msg}</Alert> : undefined}
      </Snackbar>
    </Box>
  )
}
