import { useEffect, useRef, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Tooltip from '@mui/material/Tooltip'
import { DataGrid, useGridApiRef, GridPreferencePanelsValue, type GridColDef } from '@mui/x-data-grid'
import ViewColumnIcon from '@mui/icons-material/ViewColumn'
import type { ImportDiff } from '../../api/accountAuthImport'
import { AUTH_CRITICAL_FIELDS } from '../../api/accountAuthImport'
import type { AccountAuthInput } from '../../api/accountAuth'

type Props = {
  open: boolean
  diff: ImportDiff | null
  onClose: () => void
  /** 承認。コメント欄を手動編集していた場合は { 行番号: 編集後の文字列 } を渡す */
  onApply: (commentOverrides: Record<number, string>) => void
  applying: boolean
}

type Kind = '追加' | '変更' | '削除' | 'リストア'

const KIND_COLOR: Record<Kind, 'success' | 'info' | 'error' | 'warning'> = {
  追加: 'success', 変更: 'info', 削除: 'error', リストア: 'warning',
}

// 一覧テーブルと揃えたカラム定義（id/reg_date/upd_dateは取り込み対象外のため除く）。
// delfgは「状態」列として出す。区分チップ（追加/変更/削除/リストア）はDBとの
// 差分の種類（遷移）を表すだけで、今その行が有効か削除済みかは別の情報。
// 例えば「変更」行はdelfgがDBとExcelで一致している場合に付くが、それは
// 「有効のまま項目が変わった」場合と「削除済みのまま項目が変わった（解約後の
// 台帳訂正）」場合の両方がありえる。区分チップだけでは区別できないため、
// この列で明示する
const COLS: { key: keyof AccountAuthInput; label: string; format?: (v: unknown) => string }[] = [
  { key: 'accountName', label: 'ユーザー名' },
  { key: 'password', label: 'パスワード' },
  { key: 'number', label: 'No.' },
  { key: 'delfg', label: '状態', format: (v) => (v ? '削除済み' : '有効') },
  { key: 'submission_date', label: '申込日' },
  { key: 'regist_date', label: '登録日' },
  { key: 'company_cd', label: '販社CD' },
  { key: 'company_name', label: '販売会社' },
  { key: 'company_store_cd', label: '販売会社店舗CD' },
  { key: 'company_store_branch_num', label: '枝番' },
  // 2026-07-14追加：この列が無く、Excel取り込みでnon_syncだけ変わった行が
  // 「変更」チップは付くのに画面上どこが変わったか分からない状態だった
  { key: 'non_sync', label: '診断対象外', format: (v) => (v ? '対象外' : '通常') },
  { key: 'store_cd', label: '販売店CD' },
  { key: 'store_name', label: '販売店名' },
  { key: 'comment', label: 'コメント', format: (v) => (v ? String(v) : '') },
]

type Row = { id: string; kind: Kind; accountName: string; record: AccountAuthInput; changedFields: string[]; line: number }

export function ImportDiffDialog({ open, diff, onClose, onApply, applying }: Props) {
  const hasChanges = !!diff && (diff.added.length + diff.changed.length + diff.deleted.length + diff.restored.length) > 0
  const hasValidationErrors = !!diff?.validationErrors.length

  // 列固定（ピン留め）はMUI X DataGrid Pro限定機能のため使えない。代わりに
  // 列表示設定ボタン（アイコンのみ）から列パネルを開閉する。
  // AccountAuthTable.tsxと同じ実装・同じ理由（トグル時のクリックアウェイ
  // 競合の回避も含む。詳細はそちらのコメント参照）
  const apiRef = useGridApiRef()
  const columnsPanelWasOpenRef = useRef(false)
  const captureColumnsPanelState = () => {
    columnsPanelWasOpenRef.current = !!apiRef.current?.state.preferencePanel.open
  }
  const toggleColumnsPanel = () => {
    if (columnsPanelWasOpenRef.current) apiRef.current?.hidePreferences()
    else apiRef.current?.showPreferences(GridPreferencePanelsValue.columns)
  }

  // コメント欄はプレビュー上で手動編集できる（自動生成の内容が意図と違う場合に
  // 直せるようにするため）。編集内容は行番号（ファイル内の行位置）に紐付けて
  // 覚えておき、「適用」時にファイルと一緒にサーバーへ渡す。サーバー側は
  // 差分をDBから再計算した後、この対応表で該当行のコメントだけ差し替える
  // （「DBを信用してファイルから作り直す」という安全設計自体は変えない）。
  // 新しいプレビュー結果が来たら編集内容はリセットする
  const [commentEdits, setCommentEdits] = useState<Record<number, string>>({})
  useEffect(() => {
    setCommentEdits({})
  }, [diff])

  // 【idはaccountNameでなくlineで作る】accountNameが重複しているレコード（このダイアログ
  // が検証エラーとして警告する対象そのもの）が2件あると、`種別-accountName`では
  // 同じidになってしまう。DataGridはidをキーに行を管理するため、idが衝突すると
  // 片方の行のセル内容がもう片方のレコードのもので上書き表示されてしまう
  // （ハイライト判定は別途lineで行っているため、ハイライトだけは正しく付くのに
  // 表示内容だけズレるという分かりにくい壊れ方になる）。lineはファイル内の
  // 全レコードで一意な通し番号なので、代わりにこちらをidに使う
  const rows: Row[] = diff
    ? [
        // 【DBに無い行がdelfg=trueで来るケース】理論上、初回のExcel取り込み時にだけ
        // 起こる（初回は台帳の全行がDBに無いので、解約済み行もそのまま「追加」になる）。
        // リストア検知のため、この行自体はDBへの登録が必須（削除しない）。区分は
        // 「追加」のままで、有効/削除済みの違いは「状態」列（delfg）で示す
        ...diff.added.map((r): Row => ({ id: `line-${r.line}`, kind: '追加', accountName: r.record.accountName, record: { ...r.record, comment: commentEdits[r.line] ?? r.record.comment }, changedFields: [], line: r.line })),
        ...diff.changed.map((c): Row => ({ id: `line-${c.line}`, kind: '変更', accountName: c.accountName, record: { ...c.after, comment: commentEdits[c.line] ?? c.after.comment }, changedFields: c.changedFields, line: c.line })),
        ...diff.deleted.map((d): Row => ({ id: `line-${d.line}`, kind: '削除', accountName: d.accountName, record: { ...d.after, comment: commentEdits[d.line] ?? d.after.comment }, changedFields: [], line: d.line })),
        ...diff.restored.map((r): Row => ({ id: `line-${r.line}`, kind: 'リストア', accountName: r.accountName, record: { ...r.after, comment: commentEdits[r.line] ?? r.after.comment }, changedFields: [], line: r.line })),
      ]
    : []

  const processRowUpdate = (newRow: Row) => {
    setCommentEdits((prev) => ({ ...prev, [newRow.line]: newRow.record.comment ?? '' }))
    return newRow
  }

  // 検証エラーが指している行番号の集合。一覧側でこの行を赤くハイライトする。
  // 【対象外になる稀なケース】他の項目に変更が一切ない（＝一覧に表示されない
  // 「変更なし」扱いの）行がエラー対象になった場合、ハイライトする行自体が
  // 画面に無いため反映されない。その場合も下の検証エラー一覧には文章で出る
  const errorLines = new Set((diff?.validationErrors ?? []).map((e) => e.line))

  const columns: GridColDef<Row>[] = [
    {
      field: 'kind',
      headerName: '区分',
      width: 90,
      sortable: false,
      renderCell: (params) => <Chip size="small" label={params.row.kind} color={KIND_COLOR[params.row.kind]} />,
    },
    ...COLS.map((c): GridColDef<Row> => {
      // コメントは運用担当者の手入力＋自動追記で長くなりがちなので、固定幅で
      // 切り詰めず残りの横幅いっぱいまで伸ばす
      const isComment = c.key === 'comment'
      return {
        field: c.key,
        headerName: c.label,
        ...(isComment ? { flex: 1, minWidth: 220 } : { width: 140 }),
        sortable: false,
        // コメントだけ編集可能にする（自動生成の内容を手動で直せるようにする要望）。
        // valueGetter/valueSetterはrow.record[key]という入れ子構造を読み書きする
        // ためのもの（DataGridの既定のeditable動作はrowの直下フィールドを想定
        // しているため、コメントだけ明示的にvalueSetterで書き込み先を指定する）
        editable: isComment,
        valueGetter: (_value, row) => row.record[c.key],
        ...(isComment ? {
          valueSetter: (value: string, row: Row) => ({ ...row, record: { ...row.record, comment: value } }),
        } : {}),
        // 【全列でツールチップを出す】コメントに限らず、どの列も内容が溢れうる
        // （ユーザー名・販売会社名等）ため、renderCellを全列に適用しMUIの
        // Tooltip＋省略表示に統一する（renderCellが無い列はDataGridがネイティブ
        // title属性を付け、ブラウザ標準の飾り気のないツールチップになるため）
        renderCell: (params) => {
          const v = params.row.record[c.key]
          // 【コメント列は自動追記の有無で強調する】commentはExcelとの差分
          // 検知対象から除外している（changedFieldsに入らない）ため、変更/削除/
          // リストアの行では必ず監査コメントが自動追記されているにも関わらず、
          // 通常の強調ロジックのままだと他の列と同じ見た目に埋もれてしまう。
          // 追加行以外は必ず自動追記されるという前提のもとで強調する
          const isCommentAutoAppended = isComment && params.row.kind !== '追加'
          const isChanged = params.row.changedFields.includes(c.key) || isCommentAutoAppended
          const isCritical = isChanged && AUTH_CRITICAL_FIELDS.includes(c.key)
          const display = c.format ? c.format(v) : (v === null || v === undefined ? '' : String(v))
          const content = (
            <Box
              component="span"
              sx={{
                fontWeight: isChanged ? 700 : 400,
                color: isCritical ? 'error.main' : isChanged ? 'info.main' : 'text.primary',
                display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {isCritical && '★'}{display}
            </Box>
          )
          return (
            <Tooltip title={display} placement="bottom-start">
              <span style={{ display: 'block', width: '100%', overflow: 'hidden' }}>{content}</span>
            </Tooltip>
          )
        },
      }
    }),
  ]

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth={false} slotProps={{ paper: { sx: { width: '95vw' } } }}>
      <DialogTitle>取り込みプレビュー（差分の確認）</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          この画面ではまだDBに書き込みません。内容を確認してください（★の付いた認証系の変更は特に注意）。
        </Alert>
        {/* 列表示設定は表から独立させ、表の右上にアイコンのみで置く（AccountAuthTable.tsxと同じ見た目に統一） */}
        <Stack direction="row" sx={{ mb: 0.5, justifyContent: 'flex-end' }}>
          <Tooltip title="列表示設定">
            <IconButton
              size="small"
              aria-label="列表示設定"
              onPointerDown={captureColumnsPanelState}
              onClick={toggleColumnsPanel}
              sx={{ color: 'text.secondary', '&:hover': { bgcolor: 'action.hover' } }}
            >
              <ViewColumnIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
        <Box sx={{ height: '60vh' }}>
          <DataGrid
            apiRef={apiRef}
            rows={rows}
            columns={columns}
            density="compact"
            disableRowSelectionOnClick
            getRowClassName={(params) => (errorLines.has(params.row.line) ? 'import-error-row' : '')}
            sx={{ '& .import-error-row': { bgcolor: 'error.light', '&:hover': { bgcolor: 'error.light' } } }}
            processRowUpdate={processRowUpdate}
            onProcessRowUpdateError={(e) => console.error('コメント編集の反映に失敗しました', e)}
            // 承認前レビューなので、ページ送りで見落とすリスクを避けるため
            // 常に全件を1ページで表示する（仮想化は独立して効くため性能は
            // 変わらない。詳細は AccountAuthTable.tsx の同種コメント参照）。
            // ページネーションは使わないのでフッター（ページ送り矢印・件数
            // range表示）は隠し、件数は下のTypographyでシンプルに表示する
            initialState={{
              pagination: { paginationModel: { pageSize: -1 } },
              // 水平スクロールを減らすため、優先度が低い列はデフォルト非表示。
              // 表右上の列表示設定ボタン（列パネル）でいつでも表示に戻せる
              columns: {
                columnVisibilityModel: {
                  submission_date: false, regist_date: false,
                  company_store_cd: false, company_store_branch_num: false, store_cd: false,
                },
              },
            }}
            pageSizeOptions={[{ value: -1, label: 'すべて' }]}
            hideFooter
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
          {rows.length} 件
        </Typography>
        {hasValidationErrors && (
          <Alert severity="error" sx={{ mt: 1 }}>
            検証エラーがあります。この内容のままでは適用できません（{diff.validationErrors.length}件）:
            <Box component="ul" sx={{ m: 0, pl: 3 }}>
              {diff.validationErrors.map((e) => <li key={`${e.line}-${e.message}`}>{e.message}</li>)}
            </Box>
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={applying}>閉じる</Button>
        <Button variant="contained" onClick={() => onApply(commentEdits)} disabled={!hasChanges || hasValidationErrors || applying}>
          {applying ? '適用中…' : 'この内容で適用'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
