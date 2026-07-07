import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Divider from '@mui/material/Divider'
import type { ImportDiff } from '../../api/accountAuthImport'
import { AUTH_CRITICAL_FIELDS } from '../../api/accountAuthImport'

type Props = {
  open: boolean
  diff: ImportDiff | null
  onClose: () => void
  // apply は次段階。今は差分を見るだけ（書き込みなし）
}

function Section({ title, count, color, children }: { title: string; count: number; color: 'success' | 'info' | 'error' | 'warning'; children?: import('react').ReactNode }) {
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Chip label={count} color={color} size="small" />
        <Typography variant="subtitle2">{title}</Typography>
      </Box>
      {count > 0 && <Box sx={{ pl: 1 }}>{children}</Box>}
    </Box>
  )
}

export function ImportDiffDialog({ open, diff, onClose }: Props) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>取り込みプレビュー（差分の確認）</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          この画面ではまだDBに書き込みません。内容を確認してください（★の付いた認証系の変更は特に注意）。
        </Alert>
        {diff && (
          <Stack spacing={2} divider={<Divider />}>
            <Section title="追加" count={diff.added.length} color="success">
              {diff.added.map((a) => <Typography key={a.username} variant="body2">＋ {a.username}</Typography>)}
            </Section>

            <Section title="変更" count={diff.changed.length} color="info">
              {diff.changed.map((c) => (
                <Typography key={c.username} variant="body2">
                  ● {c.username}：{c.changedFields.map((f) => (
                    <Box component="span" key={f} sx={{ mr: 1, color: AUTH_CRITICAL_FIELDS.includes(f) ? 'error.main' : 'text.primary', fontWeight: AUTH_CRITICAL_FIELDS.includes(f) ? 700 : 400 }}>
                      {AUTH_CRITICAL_FIELDS.includes(f) ? `★${f}` : f}
                    </Box>
                  ))}
                </Typography>
              ))}
            </Section>

            <Section title="削除（論理）" count={diff.deleted.length} color="error">
              {diff.deleted.map((d) => <Typography key={d.username} variant="body2">－ {d.username}</Typography>)}
            </Section>

            <Section title="リストア" count={diff.restored.length} color="warning">
              {diff.restored.map((d) => <Typography key={d.username} variant="body2">↩ {d.username}</Typography>)}
            </Section>

            <Typography variant="caption" color="text.secondary">変更なし：{diff.unchangedCount} 件（表示しません）</Typography>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>閉じる</Button>
        <Button variant="contained" disabled title="適用は次段階で実装予定">この内容で適用（次段階）</Button>
      </DialogActions>
    </Dialog>
  )
}
