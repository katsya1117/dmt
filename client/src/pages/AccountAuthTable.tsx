// ┌─────────────────────────────────────────────────────────────┐
// │ レイヤ: 画面（ページコンポーネント = フローの出発点）          │
// │ 流れ:  【ここ】 → RTK Query(accountAuthApi) → API関数 → HTTP → Express(or MSW)│
// │                                                               │
// │ 役割: 見た目と操作だけに集中する。データ取得・送信は           │
// │       accountAuthApi の生成フックに任せ、自分は fetch を一切書かない。│
// │  - 一覧表示      : useAccountAuthListQuery() の data を並べる    │
// │  - 追加/更新/削除: useCreateAccountAuthMutation() 等（RTK Query）を呼ぶ│
// │  - 画面固有の状態(ダイアログ開閉・選択行・トースト)だけ useState│
// │  - 一覧テーブルは MUI DataGrid（仮想化込み・大量行対応）        │
// └─────────────────────────────────────────────────────────────┘
import { useCallback, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import { DataGrid, GridActionsCellItem, type GridColDef } from '@mui/x-data-grid'
import EditIcon from '@mui/icons-material/Edit'
import AddIcon from '@mui/icons-material/Add'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import { accountAuthApi } from '../store/services/accountAuthApi'
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
  const { data, isLoading, error } = accountAuthApi.useAccountAuthListQuery(true)
  const [create, { isLoading: creating }] = accountAuthApi.useCreateAccountAuthMutation()
  const [update, { isLoading: updating }] = accountAuthApi.useUpdateAccountAuthMutation()
  const [applyImportDiff, { isLoading: applying }] = accountAuthApi.useApplyAccountAuthImportDiffMutation()
  // removeAccountAuth は削除機能未開放のため不使用

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<AccountAuth | null>(null)
  const [toast, setToast] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null)
  // ブラウザ標準の confirm() は使わない（見た目が浮く）。
  // トースト（Snackbar）は非モーダルで背景操作をブロックしないため、ユーザーの
  // 決定を要求する確認には不向き（2026-07-16、トースト版から変更）。
  // AccountAuthFormDialog/ImportDiffDialogと同じMUI Dialog（モーダル）に統一する
  const [confirmState, setConfirmState] = useState<{ message: string; onConfirm: () => void } | null>(null)

  // 差分プレビュー（マスタ/差分ファイル取り込み。プレビューは書き込みなし）
  // パースはサーバー側で行う（ファイルをそのままアップロード）。理由は
  // components/accountAuth/parseExcel.ts の冒頭コメントを参照
  const [diff, setDiff] = useState<ImportDiff | null>(null)
  const [diffOpen, setDiffOpen] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const previewFileRef = useRef<HTMLInputElement>(null)
  // 大きいファイルだとサーバー側の解析に数秒かかる。ここが無いと「画面が固まった」
  // と誤解される（docs/design/account-auth/13_状態遷移図.md で指摘済みの課題）
  const [previewLoading, setPreviewLoading] = useState(false)

  // No.とユーザー名は別欄・AND条件で絞り込む（onChangeで即時フィルタ）。
  // 以前は1つの欄でOR検索していたが、usernameに数字を含むデータ
  // （例: user000001）とNo.検索が紛らわしく衝突しうるため分離した（2026-07-16）
  // useMemoで固定：data/検索欄以外のstate変更（トースト表示等）で毎回
  // 再計算されるのを防ぐ（2026-07-14、絞り込みが重く感じる問題への対処）
  const [numberSearch, setNumberSearch] = useState('')
  const [usernameSearch, setUsernameSearch] = useState('')
  const filteredData = useMemo(() => data?.filter((row) => {
    const numQ = numberSearch.trim().toLowerCase()
    const userQ = usernameSearch.trim().toLowerCase()
    if (numQ && !String(row.number ?? '').includes(numQ)) return false
    if (userQ && !row.username.toLowerCase().includes(userQ)) return false
    return true
  }), [data, numberSearch, usernameSearch])

  // マスタ全件など大量の変更を誤って流し込む事故を防ぐための確認閾値
  const APPLY_CONFIRM_THRESHOLD = 50

  const handlePreviewFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPreviewLoading(true)
    try {
      const result = await previewImport(file)
      setDiff(result)
      setPendingFile(file)
      setDiffOpen(true)
    } catch (err) {
      setToast({ msg: (err as Error).message ?? '差分計算に失敗しました', severity: 'error' })
    } finally {
      setPreviewLoading(false)
      if (previewFileRef.current) previewFileRef.current.value = ''
    }
  }

  const doApply = () => {
    if (!pendingFile) return
    applyImportDiff(pendingFile).unwrap()
      .then((r) => {
        setDiffOpen(false)
        setDiff(null)
        setPendingFile(null)
        setToast({ msg: `適用しました（追加${r.inserted}・変更${r.updated}・削除${r.deleted}・リストア${r.restored}）`, severity: 'success' })
      })
      .catch((err) => setToast({ msg: (err as Error).message ?? '適用に失敗しました', severity: 'error' }))
  }

  const handleApply = () => {
    if (!pendingFile || !diff) return
    const changeCount = diff.added.length + diff.changed.length + diff.deleted.length + diff.restored.length
    if (changeCount >= APPLY_CONFIRM_THRESHOLD) {
      setConfirmState({ message: `${changeCount}件の変更を適用します。よろしいですか？`, onConfirm: doApply })
      return
    }
    doApply()
  }

  const openAdd = () => { setEditTarget(null); setDialogOpen(true) }
  // useCallback：setEditTarget/setDialogOpenはReactが安定した参照を保証するので、
  // 依存配列を空にでき、openEditの参照が変わらない（下のcolumnsのuseMemoが効くために必要）
  const openEdit = useCallback((row: AccountAuth) => { setEditTarget(row); setDialogOpen(true) }, [])

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
  // store/services/accountAuthApi.ts の removeAccountAuth エンドポイントを戻す。
  // const [remove] = accountAuthApi.useRemoveAccountAuthMutation()
  // const handleDelete = (row: AccountAuth) => {
  //   setConfirmState({
  //     message: `「${row.username}」を削除しますか？`,
  //     onConfirm: () => {
  //       remove(row.id).unwrap()
  //         .then(() => setToast({ msg: '削除しました', severity: 'success' }))
  //         .catch((e) => setToast({ msg: (e as Error).message, severity: 'error' }))
  //     },
  //   })
  // }

  // useMemoで固定：openEdit（安定した参照）以外に依存が無いので、絞り込み等の
  // 他state変更では再生成されない（2026-07-14、絞り込みが重く感じる問題への対処。
  // 固定化前は検索欄を1文字打つたびにcolumns配列が丸ごと作り直され、DataGridが
  // 「列定義が変わった」と判断して余分な再構築コストを払っていた）
  const columns: GridColDef<AccountAuth>[] = useMemo(() => [
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
  ], [openEdit])

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h1" gutterBottom>アカウント認証テーブル</Typography>

      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>新規追加</Button>
        <Button
          variant="outlined"
          startIcon={<UploadFileIcon />}
          loading={previewLoading}
          loadingPosition="start"
          onClick={() => previewFileRef.current?.click()}
        >
          {previewLoading ? '差分を計算中…' : 'Excel取り込み（差分プレビュー）'}
        </Button>
        <input ref={previewFileRef} type="file" accept=".xlsx,.xls" hidden onChange={handlePreviewFile} />
        <TextField
          size="small"
          sx={{ width: 140 }}
          label="No.で絞り込み"
          placeholder="例: 1001"
          value={numberSearch}
          onChange={(e) => setNumberSearch(e.target.value)}
        />
        <TextField
          size="small"
          sx={{ width: 180 }}
          label="ユーザー名で絞り込み"
          placeholder="例: dealer001"
          value={usernameSearch}
          onChange={(e) => setUsernameSearch(e.target.value)}
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
          sx={{ '& .account-auth-deleted-row': { opacity: 0.6 }, '& .MuiDataGrid-row': { cursor: 'pointer' } }}
          disableRowSelectionOnClick
          // 操作列を右端固定できない（列固定はPro限定）ため、行のどこをクリック
          // しても編集ダイアログが開くようにした。横長テーブルで編集ボタンを
          // 探すためのスクロールが不要になる（2026-07-15）
          onRowClick={(params) => openEdit(params.row)}
          // 検索は「入力した瞬間に全結果が見える」設計。
          // 【重要】hideFooterはページネーションUIを隠すだけで、ページネーション
          // 自体は無効化されない（Community版は`pagination`を常時trueで無効化
          // 不可）。initialStateでpageSize=-1（全件を1ページに）を明示しないと、
          // デフォルトの100件だけが表示され、UIが無いので気づけない不具合になる
          // （2026-07-14、hideFooter追加時にこの指定を誤って消してしまい発生）。
          // 総件数は下のTypographyで別途表示する
          initialState={{ pagination: { paginationModel: { pageSize: -1 } } }}
          pageSizeOptions={[{ value: -1, label: 'すべて' }]}
          hideFooter
          slots={{
            noRowsOverlay: () => (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                {data?.length === 0 ? 'データがありません' : '該当する行がありません'}
              </Box>
            ),
          }}
        />
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        {filteredData?.length ?? 0} 件
        {(numberSearch.trim() || usernameSearch.trim()) && ` （全 ${data?.length ?? 0} 件中）`}
      </Typography>

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

      {/* confirm()の代わりのモーダル確認ダイアログ。背景操作をブロックし、
          キャンセル/実行いずれかを押すまで先に進めない */}
      <Dialog open={Boolean(confirmState)} onClose={() => setConfirmState(null)} maxWidth="xs" fullWidth>
        <DialogTitle>確認</DialogTitle>
        <DialogContent>
          <DialogContentText>{confirmState?.message}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmState(null)}>キャンセル</Button>
          <Button
            variant="contained"
            onClick={() => { confirmState?.onConfirm(); setConfirmState(null) }}
            autoFocus
          >
            実行
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
