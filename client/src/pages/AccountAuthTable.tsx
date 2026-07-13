// ┌─────────────────────────────────────────────────────────────┐
// │ レイヤ: 画面（ページコンポーネント = フローの出発点）          │
// │ 流れ:  【ここ】 → フック → API関数 → HTTP → Express(or MSW)   │
// │                                                               │
// │ 役割: 見た目と操作だけに集中する。データ取得・送信は           │
// │       useAccountAuth* フックに任せ、自分は fetch を一切書かない。│
// │  - 一覧表示      : useAccountAuthList() の data を並べる        │
// │  - 追加/更新/削除: useCreateAccountAuth() 等（RTK Query）を呼ぶ │
// │  - 画面固有の状態(ダイアログ開閉・選択行・トースト)だけ useState│
// │  - 一覧テーブルは MUI DataGrid（仮想化込み・大量行対応）        │
// └─────────────────────────────────────────────────────────────┘
import { useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import { DataGrid, GridActionsCellItem, type GridColDef } from '@mui/x-data-grid'
import EditIcon from '@mui/icons-material/Edit'
import AddIcon from '@mui/icons-material/Add'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import { useAccountAuthList, useCreateAccountAuth, useUpdateAccountAuth, useApplyAccountAuthImport } from '../hooks/useAccountAuth'
import { AccountAuthFormDialog } from '../components/accountAuth/AccountAuthFormDialog'
import { ImportDiffDialog } from '../components/accountAuth/ImportDiffDialog'
import { previewImport, type ImportDiff } from '../api/accountAuthImport'
import type { AccountAuth, AccountAuthInput } from '../api/accountAuth'

// テキスト列（診断対象外/状態/操作 は別途renderCellで描画）
const TEXT_COLS: { key: keyof AccountAuth; label: string; width: number }[] = [
  { key: 'id', label: 'ID', width: 70 },
  { key: 'username', label: 'ユーザー名', width: 140 },
  { key: 'password', label: 'パスワード', width: 140 },
  { key: 'number', label: 'No.', width: 90 },
  { key: 'submission_date', label: '申込日', width: 110 },
  { key: 'regist_date', label: '登録日', width: 110 },
  { key: 'company_cd', label: '販社CD', width: 100 },
  { key: 'company_name', label: '販売会社', width: 140 },
  { key: 'company_store_cd', label: '販売会社店舗CD', width: 140 },
  { key: 'company_store_branch_num', label: '枝番', width: 90 },
  { key: 'store_cd', label: '販売店CD', width: 100 },
  { key: 'store_name', label: '販売店名', width: 140 },
  { key: 'comment', label: '備考', width: 200 },
  { key: 'reg_date', label: '登録日時', width: 160 },
  { key: 'upd_date', label: '更新日時', width: 160 },
]

export default function AccountAuthTable() {
  // 削除は行を消すことではなく状態を変えるだけ。常に全件（削除済み含む）表示し、
  // 状態は「状態」列のチップで区別する（行ごと消えるとリストアの手段が無くなるため）
  const { data, isLoading, error } = useAccountAuthList(true)
  const [create, { isLoading: creating }] = useCreateAccountAuth()
  const [update, { isLoading: updating }] = useUpdateAccountAuth()
  const [applyImportDiff, { isLoading: applying }] = useApplyAccountAuthImport()
  // remove は削除機能未開放のため不使用

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<AccountAuth | null>(null)
  const [toast, setToast] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null)

  // 差分プレビュー（マスタ/差分ファイル取り込み。プレビューは書き込みなし）
  // パースはサーバー側で行う（ファイルをそのままアップロード）。理由は
  // components/accountAuth/parseExcel.ts の冒頭コメントを参照
  const [diff, setDiff] = useState<ImportDiff | null>(null)
  const [diffOpen, setDiffOpen] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const previewFileRef = useRef<HTMLInputElement>(null)

  // No./ユーザー名の入力のたびにテーブルを絞り込む（onChangeで即時フィルタ）
  const [searchText, setSearchText] = useState('')
  const filteredData = data?.filter((row) => {
    const q = searchText.trim().toLowerCase()
    if (!q) return true
    return String(row.number ?? '').includes(q) || row.username.toLowerCase().includes(q)
  })

  // マスタ全件など大量の変更を誤って流し込む事故を防ぐための確認閾値
  const APPLY_CONFIRM_THRESHOLD = 50

  const handlePreviewFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const result = await previewImport(file)
      setDiff(result)
      setPendingFile(file)
      setDiffOpen(true)
    } catch (err) {
      setToast({ msg: (err as Error).message ?? '差分計算に失敗しました', severity: 'error' })
    } finally {
      if (previewFileRef.current) previewFileRef.current.value = ''
    }
  }

  const handleApply = () => {
    if (!pendingFile || !diff) return
    const changeCount = diff.added.length + diff.changed.length + diff.deleted.length + diff.restored.length
    if (changeCount >= APPLY_CONFIRM_THRESHOLD) {
      if (!confirm(`${changeCount}件の変更を適用します。よろしいですか？`)) return
    }
    applyImportDiff(pendingFile).unwrap()
      .then((r) => {
        setDiffOpen(false)
        setDiff(null)
        setPendingFile(null)
        setToast({ msg: `適用しました（追加${r.inserted}・変更${r.updated}・削除${r.deleted}・リストア${r.restored}）`, severity: 'success' })
      })
      .catch((err) => setToast({ msg: (err as Error).message ?? '適用に失敗しました', severity: 'error' }))
  }

  const openAdd = () => { setEditTarget(null); setDialogOpen(true) }
  const openEdit = (row: AccountAuth) => { setEditTarget(row); setDialogOpen(true) }

  // 送信はPromiseを返す（失敗はthrowされ、ダイアログがフィールドエラーに紐付ける）
  const handleSubmit = async (input: AccountAuthInput) => {
    if (editTarget) {
      await update({ id: editTarget.id, input }).unwrap()
    } else {
      await create([input]).unwrap()
    }
  }

  // 送信成功時：ダイアログを閉じてトースト
  const handleSuccess = () => {
    setDialogOpen(false)
    setToast({ msg: editTarget ? '更新しました' : '追加しました', severity: 'success' })
  }

  // 【削除機能 未開放】客先DBで物理削除が不調のため。論理削除は編集フォームの
  // delfg スイッチ（PUT）で行う。開放する時はこの関数と一覧の削除ボタン、
  // hooks/useAccountAuth.ts の useRemoveAccountAuth を戻す。
  // const [remove] = useRemoveAccountAuth()
  // const handleDelete = (row: AccountAuth) => {
  //   if (!confirm(`「${row.username}」を削除しますか？`)) return
  //   remove(row.id).unwrap()
  //     .then(() => setToast({ msg: '削除しました', severity: 'success' }))
  //     .catch((e) => setToast({ msg: (e as Error).message, severity: 'error' }))
  // }

  const columns: GridColDef<AccountAuth>[] = [
    ...TEXT_COLS.map((c): GridColDef<AccountAuth> => ({
      field: c.key,
      headerName: c.label,
      width: c.width,
      valueFormatter: (value) => (value === null || value === undefined ? '—' : value),
    })),
    {
      field: 'non_sync',
      headerName: '診断対象外',
      width: 110,
      sortable: false,
      renderCell: (params) => (
        <Chip label={params.row.non_sync ? '対象外' : '通常'} color={params.row.non_sync ? 'warning' : 'default'} size="small" />
      ),
    },
    {
      field: 'delfg',
      headerName: '状態',
      width: 110,
      sortable: false,
      renderCell: (params) =>
        params.row.delfg
          ? <Chip label="削除済み" color="error" size="small" />
          : <Chip label="有効" color="success" variant="outlined" size="small" />,
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: '操作',
      width: 80,
      getActions: (params) => [
        <GridActionsCellItem key="edit" icon={<EditIcon fontSize="small" />} label="編集" onClick={() => openEdit(params.row)} />,
      ],
    },
  ]

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h1" gutterBottom>アカウント認証テーブル</Typography>

      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>新規追加</Button>
        <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => previewFileRef.current?.click()}>
          Excel取り込み（差分プレビュー）
        </Button>
        <input ref={previewFileRef} type="file" accept=".xlsx,.xls" hidden onChange={handlePreviewFile} />
        <TextField
          size="small"
          sx={{ width: 260 }}
          label="No./ユーザー名で絞り込み"
          placeholder="例: 1001"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{(error as Error).message}</Alert>}

      <Box sx={{ height: '70vh' }}>
        <DataGrid
          rows={filteredData ?? []}
          columns={columns}
          loading={isLoading}
          density="compact"
          getRowClassName={(params) => (params.row.delfg ? 'account-auth-deleted-row' : '')}
          sx={{ '& .account-auth-deleted-row': { opacity: 0.6 } }}
          disableRowSelectionOnClick
          // 検索は「入力した瞬間に全件見える」設計のため、ページネーションで
          // 結果が隠れないようデフォルトを「すべて表示」にする（仮想化は
          // ページサイズと独立して効くため性能は変わらない。公式サポートの
          // pageSize=-1機能。docs/アカウント認証_Excel取り込み設計.md参照）
          initialState={{ pagination: { paginationModel: { pageSize: -1 } } }}
          pageSizeOptions={[25, 50, 100, { value: -1, label: 'すべて' }]}
          slots={{
            noRowsOverlay: () => (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                {data?.length === 0 ? 'データがありません' : '該当する行がありません'}
              </Box>
            ),
          }}
        />
      </Box>

      <AccountAuthFormDialog
        open={dialogOpen}
        target={editTarget}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        onSuccess={handleSuccess}
        submitting={creating || updating}
      />

      <ImportDiffDialog
        open={diffOpen}
        diff={diff}
        onClose={() => setDiffOpen(false)}
        onApply={handleApply}
        applying={applying}
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
