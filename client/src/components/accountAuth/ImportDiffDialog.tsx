import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
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

type Row = { id: string; kind: Kind; username: string; record: AccountAuthInput; changedFields: string[] }

export function ImportDiffDialog({ open, diff, onClose, onApply, applying }: Props) {
  const hasChanges = !!diff && (diff.added.length + diff.changed.length + diff.deleted.length + diff.restored.length) > 0

  const rows: Row[] = diff
    ? [
        ...diff.added.map((r): Row => ({ id: `追加-${r.username}`, kind: '追加', username: r.username, record: r, changedFields: [] })),
        ...diff.changed.map((c): Row => ({ id: `変更-${c.username}`, kind: '変更', username: c.username, record: c.after, changedFields: c.changedFields })),
        ...diff.deleted.map((r): Row => ({ id: `削除-${r.username}`, kind: '削除', username: r.username, record: r, changedFields: [] })),
        ...diff.restored.map((r): Row => ({ id: `リストア-${r.username}`, kind: 'リストア', username: r.username, record: r, changedFields: [] })),
      ]
    : []

  const columns: GridColDef<Row>[] = [
    {
      field: 'kind',
      headerName: '区分',
      width: 90,
      sortable: false,
      renderCell: (params) => <Chip size="small" label={params.row.kind} color={KIND_COLOR[params.row.kind]} />,
    },
    ...COLS.map((c): GridColDef<Row> => ({
      field: c.key,
      headerName: c.label,
      width: 140,
      sortable: false,
      valueGetter: (_value, row) => row.record[c.key],
      renderCell: (params) => {
        const v = params.row.record[c.key]
        const isChanged = params.row.changedFields.includes(c.key)
        const isCritical = isChanged && AUTH_CRITICAL_FIELDS.includes(c.key)
        return (
          <Box
            component="span"
            sx={{
              fontWeight: isChanged ? 700 : 400,
              color: isCritical ? 'error.main' : isChanged ? 'info.main' : 'text.primary',
            }}
          >
            {isCritical && '★'}{v === null || v === undefined || v === '' ? '—' : String(v)}
          </Box>
        )
      },
    })),
  ]

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth={false} slotProps={{ paper: { sx: { width: '95vw' } } }}>
      <DialogTitle>取り込みプレビュー（差分の確認）</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          この画面ではまだDBに書き込みません。内容を確認してください（★の付いた認証系の変更は特に注意）。
        </Alert>
        <Box sx={{ height: '60vh' }}>
          <DataGrid
            rows={rows}
            columns={columns}
            density="compact"
            disableRowSelectionOnClick
            slots={{
              noRowsOverlay: () => (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  変更はありません
                </Box>
              ),
            }}
          />
        </Box>
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
