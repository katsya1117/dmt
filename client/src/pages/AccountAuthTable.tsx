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
// import DeleteIcon from '@mui/icons-material/Delete' // 削除機能 未開放。開放時に戻す
import AddIcon from '@mui/icons-material/Add'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import { useAccountAuthList, useAccountAuthMutations } from '../hooks/useAccountAuth'
import { AccountAuthFormDialog } from '../components/accountAuth/AccountAuthFormDialog'
import { parseAccountAuthExcel } from '../components/accountAuth/parseExcel'
import { ImportDiffDialog } from '../components/accountAuth/ImportDiffDialog'
import { previewImport, type ImportDiff } from '../api/accountAuthImport'
import type { AccountAuth, AccountAuthInput } from '../api/accountAuth'

// 一覧に出すカラム（non_sync/操作 は別途レンダリング）
const TEXT_COLS: { key: keyof AccountAuth; label: string }[] = [
  { key: 'id', label: 'ID' },
  { key: 'username', label: 'ユーザー名' },
  { key: 'password', label: 'パスワード' },
  { key: 'number', label: 'No.' },
  { key: 'submission_date', label: '申込日' },
  { key: 'regist_date', label: '登録日' },
  { key: 'company_cd', label: '販社CD' },
  { key: 'company_name', label: '販売会社' },
  { key: 'company_store_cd', label: '販売会社店舗CD' },
  { key: 'company_store_branch_num', label: '枝番' },
  { key: 'store_cd', label: '販売店CD' },
  { key: 'store_name', label: '販売店名' },
  { key: 'comment', label: '備考' },
  { key: 'reg_date', label: '登録日時' },
  { key: 'upd_date', label: '更新日時' },
]
const COL_SPAN = TEXT_COLS.length + 2 // + 診断対象外 + 操作

export default function AccountAuthTable() {
  const { data, isLoading, error } = useAccountAuthList()
  const { create, update, applyImportDiff } = useAccountAuthMutations() // remove は削除機能未開放のため不使用

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<AccountAuth | null>(null)
  const [toast, setToast] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null)

  // 差分プレビュー（マスタ/差分ファイル取り込み。プレビューは書き込みなし）
  const [diff, setDiff] = useState<ImportDiff | null>(null)
  const [diffOpen, setDiffOpen] = useState(false)
  const [pendingRecords, setPendingRecords] = useState<AccountAuthInput[] | null>(null)
  const previewFileRef = useRef<HTMLInputElement>(null)

  // マスタ全件など大量の変更を誤って流し込む事故を防ぐための確認閾値
  const APPLY_CONFIRM_THRESHOLD = 50

  const handlePreviewFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const records = await parseAccountAuthExcel(file)
      if (records.length === 0) { setToast({ msg: '取り込める行がありませんでした', severity: 'error' }); return }
      const result = await previewImport(records)
      setDiff(result)
      setPendingRecords(records)
      setDiffOpen(true)
    } catch (err) {
      setToast({ msg: (err as Error).message ?? '差分計算に失敗しました', severity: 'error' })
    } finally {
      if (previewFileRef.current) previewFileRef.current.value = ''
    }
  }

  const handleApply = () => {
    if (!pendingRecords || !diff) return
    const changeCount = diff.added.length + diff.changed.length + diff.deleted.length + diff.restored.length
    if (changeCount >= APPLY_CONFIRM_THRESHOLD) {
      if (!confirm(`${changeCount}件の変更を適用します。よろしいですか？`)) return
    }
    applyImportDiff.mutate(pendingRecords, {
      onSuccess: (r) => {
        setDiffOpen(false)
        setDiff(null)
        setPendingRecords(null)
        setToast({ msg: `適用しました（追加${r.inserted}・変更${r.updated}・削除${r.deleted}・リストア${r.restored}）`, severity: 'success' })
      },
      onError: (err) => setToast({ msg: (err as Error).message ?? '適用に失敗しました', severity: 'error' }),
    })
  }

  const openAdd = () => { setEditTarget(null); setDialogOpen(true) }
  const openEdit = (row: AccountAuth) => { setEditTarget(row); setDialogOpen(true) }

  // 送信はPromiseを返す（失敗はthrowされ、ダイアログがフィールドエラーに紐付ける）
  const handleSubmit = async (input: AccountAuthInput) => {
    if (editTarget) {
      await update.mutateAsync({ id: editTarget.id, input })
    } else {
      await create.mutateAsync([input])
    }
  }

  // 送信成功時：ダイアログを閉じてトースト
  const handleSuccess = () => {
    setDialogOpen(false)
    setToast({ msg: editTarget ? '更新しました' : '追加しました', severity: 'success' })
  }

  // 【削除機能 未開放】客先DBで物理削除が不調のため。論理削除は編集フォームの
  // delfg スイッチ（PUT）で行う。開放する時はこの関数と一覧の削除ボタン、
  // 下の useAccountAuthMutations の remove を戻す。
  // const handleDelete = (row: AccountAuth) => {
  //   if (!confirm(`「${row.username}」を削除しますか？`)) return
  //   remove.mutate(row.id, {
  //     onSuccess: () => setToast({ msg: '削除しました', severity: 'success' }),
  //     onError: (e) => setToast({ msg: (e as Error).message, severity: 'error' }),
  //   })
  // }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h1" gutterBottom>アカウント認証テーブル</Typography>

      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>新規追加</Button>
        <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => previewFileRef.current?.click()}>
          Excel取り込み（差分プレビュー）
        </Button>
        <input ref={previewFileRef} type="file" accept=".xlsx,.xls" hidden onChange={handlePreviewFile} />
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{(error as Error).message}</Alert>}

      <TableContainer component={Paper} sx={{ maxHeight: '70vh' }}>
        <Table size="small" stickyHeader sx={{ whiteSpace: 'nowrap' }}>
          <TableHead>
            <TableRow>
              {TEXT_COLS.map((c) => <TableCell key={c.key}>{c.label}</TableCell>)}
              <TableCell>診断対象外</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={COL_SPAN}>読み込み中...</TableCell></TableRow>
            )}
            {!isLoading && data?.length === 0 && (
              <TableRow><TableCell colSpan={COL_SPAN}>データがありません</TableCell></TableRow>
            )}
            {data?.map((row) => (
              <TableRow key={row.id} hover>
                {TEXT_COLS.map((c) => {
                  const v = row[c.key]
                  return <TableCell key={c.key}>{v === null || v === undefined ? '—' : String(v)}</TableCell>
                })}
                <TableCell>
                  <Chip label={row.non_sync ? '対象外' : '通常'} color={row.non_sync ? 'warning' : 'default'} size="small" />
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => openEdit(row)} aria-label="編集"><EditIcon fontSize="small" /></IconButton>
                  {/* 削除機能 未開放（論理削除は編集フォームのdelfgで行う）。開放時に戻す:
                  <IconButton size="small" onClick={() => handleDelete(row)} aria-label="削除"><DeleteIcon fontSize="small" /></IconButton> */}
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
        onSuccess={handleSuccess}
        submitting={create.isPending || update.isPending}
      />

      <ImportDiffDialog
        open={diffOpen}
        diff={diff}
        onClose={() => setDiffOpen(false)}
        onApply={handleApply}
        applying={applyImportDiff.isPending}
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
