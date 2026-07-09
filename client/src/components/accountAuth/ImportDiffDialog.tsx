import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import type { ImportDiff } from '../../api/accountAuthImport'
import { AUTH_CRITICAL_FIELDS } from '../../api/accountAuthImport'
import type { AccountAuthInput } from '../../api/accountAuth'

type Props = {
  open: boolean
  diff: ImportDiff | null
  onClose: () => void
  onApply: () => void
  applying: boolean
}

type Kind = '追加' | '変更' | '削除' | 'リストア'

const KIND_COLOR: Record<Kind, 'success' | 'info' | 'error' | 'warning'> = {
  追加: 'success', 変更: 'info', 削除: 'error', リストア: 'warning',
}

// 一覧テーブルと揃えたカラム定義（id/reg_date/upd_dateは取り込み対象外のため除く）
const COLS: { key: keyof AccountAuthInput; label: string }[] = [
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
]

export function ImportDiffDialog({ open, diff, onClose, onApply, applying }: Props) {
  const hasChanges = !!diff && (diff.added.length + diff.changed.length + diff.deleted.length + diff.restored.length) > 0

  type Row = { kind: Kind; username: string; record: AccountAuthInput; changedFields: string[] }
  const rows: Row[] = diff
    ? [
        ...diff.added.map((r) => ({ kind: '追加' as const, username: r.username, record: r, changedFields: [] as string[] })),
        ...diff.changed.map((c) => ({ kind: '変更' as const, username: c.username, record: c.after, changedFields: c.changedFields })),
        ...diff.deleted.map((r) => ({ kind: '削除' as const, username: r.username, record: r, changedFields: [] as string[] })),
        ...diff.restored.map((r) => ({ kind: 'リストア' as const, username: r.username, record: r, changedFields: [] as string[] })),
      ]
    : []

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth={false} slotProps={{ paper: { sx: { width: '95vw' } } }}>
      <DialogTitle>取り込みプレビュー（差分の確認）</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          この画面ではまだDBに書き込みません。内容を確認してください（★の付いた認証系の変更は特に注意）。
        </Alert>
        <TableContainer component={Paper} sx={{ maxHeight: '60vh' }}>
          <Table size="small" stickyHeader sx={{ whiteSpace: 'nowrap' }}>
            <TableHead>
              <TableRow>
                <TableCell>区分</TableCell>
                {COLS.map((c) => <TableCell key={c.key}>{c.label}</TableCell>)}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={COLS.length + 1}>変更はありません</TableCell></TableRow>
              )}
              {rows.map((row) => (
                <TableRow key={`${row.kind}-${row.username}`} hover>
                  <TableCell><Chip size="small" label={row.kind} color={KIND_COLOR[row.kind]} /></TableCell>
                  {COLS.map((c) => {
                    const v = row.record[c.key]
                    const isChanged = row.changedFields.includes(c.key)
                    const isCritical = isChanged && AUTH_CRITICAL_FIELDS.includes(c.key)
                    return (
                      <TableCell
                        key={c.key}
                        sx={{
                          fontWeight: isChanged ? 700 : 400,
                          color: isCritical ? 'error.main' : isChanged ? 'info.main' : 'text.primary',
                        }}
                      >
                        {isCritical && '★'}{v === null || v === undefined || v === '' ? '—' : String(v)}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          変更なし：{diff?.unchangedCount ?? 0} 件（表示しません）
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={applying}>閉じる</Button>
        <Button variant="contained" onClick={onApply} disabled={!hasChanges || applying}>
          {applying ? '適用中…' : 'この内容で適用'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
