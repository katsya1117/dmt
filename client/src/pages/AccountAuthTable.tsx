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
import { useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Chip from '@mui/material/Chip'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import Tooltip from '@mui/material/Tooltip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import { DataGrid, useGridApiRef, GridPreferencePanelsValue, type GridColDef } from '@mui/x-data-grid'
import AddIcon from '@mui/icons-material/Add'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import ViewColumnIcon from '@mui/icons-material/ViewColumn'
import PlaylistRemoveIcon from '@mui/icons-material/PlaylistRemove'
import FindReplaceIcon from '@mui/icons-material/FindReplace'
import { accountAuthApi } from '../store/services/accountAuthApi'
import { AccountAuthFormDialog } from '../components/accountAuth/AccountAuthFormDialog'
import { ImportDiffDialog } from '../components/accountAuth/ImportDiffDialog'
import { ImportExcludeNumbersDialog } from '../components/accountAuth/ImportExcludeNumbersDialog'
import { ImportValueNormalizeRulesDialog } from '../components/accountAuth/ImportValueNormalizeRulesDialog'
import { FilterInline } from '../components/accountAuth/filterVariants/FilterInline'
import { OverflowTooltipCell } from '../components/dataGrid/OverflowTooltipCell'
import { previewImport, type ImportDiff } from '../api/accountAuthImport'
import type { AccountAuth, AccountAuthInput, AccountAuthTarget } from '../api/accountAuth'

// テキスト列（診断対象外/状態/操作 は別途renderCellで描画）。
// widthは最小幅として使い、flexも同じ比率で持たせることで、列合計が画面幅より
// 狭い時は各列が比率どおりに伸びて埋める（内容量では変わらないので、行ごとに
// 幅がチラつくこともない）
const TEXT_COLS: { key: keyof AccountAuth; label: string; width: number }[] = [
  { key: 'id', label: 'ID', width: 70 },
  { key: 'accountName', label: 'ユーザー名', width: 140 },
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
  { key: 'comment', label: 'コメント', width: 200 },
  { key: 'reg_date', label: '登録日時', width: 160 },
  { key: 'upd_date', label: '更新日時', width: 160 },
]

export default function AccountAuthTable() {
  // 通常アカウントとDIAG用アカウントは同じ構造の別テーブルで、同じ画面部品で扱う。
  // 切り替えはURLの ?target=diag に載せる（再読み込みしても保持され、リンクも共有できる）。
  // DIAGアカウントは廃止予定のため、DIAG側は既存行の閲覧・編集・論理削除と復活だけを扱い、
  // 新規追加とExcel取り込み（通常アカウント側の入口）は出さない
  const [searchParams, setSearchParams] = useSearchParams()
  const target: AccountAuthTarget = searchParams.get('target') === 'diag' ? 'diag' : 'normal'
  const isDiag = target === 'diag'
  const handleTargetChange = (_: unknown, next: AccountAuthTarget | null) => {
    if (!next) return // 同じボタンの再クリックで選択が外れるのを防ぐ（必ずどちらかが選ばれている）
    setSearchParams(next === 'diag' ? { target: 'diag' } : {}, { replace: true })
  }

  // 削除は行を消すことではなく状態を変えるだけ。常に全件（削除済み含む）表示し、
  // 状態は「状態」列のチップで区別する（行ごと消えるとリストアの手段が無くなるため）
  const { data, isLoading, error } = accountAuthApi.useAccountAuthListQuery(target)
  const [create, { isLoading: creating }] = accountAuthApi.useCreateAccountAuthMutation()
  const [update, { isLoading: updating }] = accountAuthApi.useUpdateAccountAuthMutation()
  const [applyImportDiff, { isLoading: applying }] = accountAuthApi.useApplyAccountAuthImportDiffMutation()
  // removeAccountAuth は削除機能未開放のため不使用

  // 列の表示/非表示は DataGrid 標準の「列パネル」を使う。ただし内蔵ツールバー
  // （showToolbar）はヘッダー上に余白の帯を作り、トリガーも浮いて見えるため使わず、
  // apiRef 経由で他の操作ボタンと同じ行に置いたボタンからパネルを開く（2026-08-05）。
  // 【ボタンをトグル式にする際のハマりどころ】パネルの実体（GridPanel）は、
  // このボタンではなくDataGrid内部の隠しアンカー要素（gridPanelAnchor）を
  // target にしている。そのためパネルのクリックアウェイ判定はこのボタンを
  // 「外側」とみなし、パネルが開いている時にこのボタンを押すと pointerup の
  // 時点でクリックアウェイが先に発火してパネルを閉じてしまう。その後に
  // onClickのトグル判定が走ると、既にstateが「閉じた後」になっているため
  // 「開く」と誤判定して即座に再オープンしてしまう（クリックしても閉じない
  // ように見える不具合の原因）。pointerdown（クリックアウェイのpointerupより
  // 必ず先に発火する）の時点で開閉状態をrefに退避しておき、onClickではその
  // 退避値だけを見て判断することでこの競合を避ける
  const apiRef = useGridApiRef()
  const columnsPanelWasOpenRef = useRef(false)
  const captureColumnsPanelState = () => {
    columnsPanelWasOpenRef.current = !!apiRef.current?.state.preferencePanel.open
  }
  const toggleColumnsPanel = () => {
    if (columnsPanelWasOpenRef.current) apiRef.current?.hidePreferences()
    else apiRef.current?.showPreferences(GridPreferencePanelsValue.columns)
  }

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
  // と誤解される（docs/design/account-auth/13_状態遷移図.md で指摘済みの���題）
  const [previewLoading, setPreviewLoading] = useState(false)
  // 除外リスト・正規化ルールの管理ダイアログ。取り込みの差分プレビューとは
  // 独立した「次回以降ずっと効く設定」なので、プレビューを開かなくても
  // ここから直接開けるようにする（以前はImportDiffDialog内にしか入口が無く、
  // Excelを取り込んで初めてたどり着ける導線になっていたため移設。2026-10-26）
  const [excludeListDialogOpen, setExcludeListDialogOpen] = useState(false)
  const [normalizeRulesDialogOpen, setNormalizeRulesDialogOpen] = useState(false)

  // No.とユーザー名は別欄・AND条件で絞り込む（onChangeで即時フィルタ）。
  // 以前は1つの欄でOR検索していたが、accountNameに数字を含むデータ
  // （例: user000001）とNo.検索が紛らわしく衝突しうるため分離した（2026-07-16）
  // useMemoで固定：data/検索欄以外のstate変更（トースト表示等）で毎回
  // 再計算されるのを防ぐ（2026-07-14、絞り込みが重く感じる問題への対処）
  const [numberSearch, setNumberSearch] = useState('')
  const [accountNameSearch, setAccountNameSearch] = useState('')
  const isFiltering = Boolean(numberSearch.trim() || accountNameSearch.trim())
  const filteredData = useMemo(() => data?.filter((row) => {
    const numQ = numberSearch.trim().toLowerCase()
    const userQ = accountNameSearch.trim().toLowerCase()
    if (numQ && !String(row.number ?? '').includes(numQ)) return false
    if (userQ && !row.accountName.toLowerCase().includes(userQ)) return false
    return true
  }), [data, numberSearch, accountNameSearch])

  // マスタ全件など大量の変更を誤って流し込む事故を防ぐための確認閾値
  const APPLY_CONFIRM_THRESHOLD = 50

  // 新規追加時のNo.初期値（提案）。過去に使われたNo.（削除済み含む全件）の
  // 最大値+1を提案する。削除済みのNo.は再利用可能というルールだが、それでも
  // 「一度でも使われた番号」を再提案すると紛らわしいため、あえて削除済みも
  // 含めて最大値を取る。あくまで初期値であり、ユーザーは自由に変更できる
  const suggestedNumber = useMemo(() => {
    const max = data?.reduce((m, r) => (r.number != null && r.number > m ? r.number : m), 0) ?? 0
    return max + 1
  }, [data])

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

  const doApply = (commentOverrides: Record<number, string>, applyLines: number[]) => {
    if (!pendingFile) return
    applyImportDiff({ file: pendingFile, commentOverrides, applyLines }).unwrap()
      .then((r) => {
        setDiffOpen(false)
        setDiff(null)
        setPendingFile(null)
        setToast({ msg: `適用しました（追加${r.inserted}・変更${r.updated}・削除${r.deleted}・リストア${r.restored}・権限${r.authoritySynced}・DIAG用${r.diagWritten}）`, severity: 'success' })
      })
      .catch((err) => setToast({ msg: (err as Error).message ?? '適用に失敗しました', severity: 'error' }))
  }

  // changeCountは「選択された件数」（＝実際にDBへ反映される件数）を見る。
  // diff全体の件数で出すと、一部の行だけ選択した場合に確認メッセージの件数が
  // 実態と合わなくなるため
  const handleApply = (commentOverrides: Record<number, string>, applyLines: number[]) => {
    if (!pendingFile || !diff) return
    const changeCount = applyLines.length
    if (changeCount >= APPLY_CONFIRM_THRESHOLD) {
      setConfirmState({ message: `${changeCount}件の変更を適用します。よろしいですか？`, onConfirm: () => doApply(commentOverrides, applyLines) })
      return
    }
    doApply(commentOverrides, applyLines)
  }

  const openAdd = () => { setEditTarget(null); setDialogOpen(true) }
  // useCallback：setEditTarget/setDialogOpenはReactが安定した参照を保証するので、
  // 依存配列を空にでき、openEditの参照が変わらない（下のcolumnsのuseMemoが効くために必要）
  const openEdit = useCallback((row: AccountAuth) => { setEditTarget(row); setDialogOpen(true) }, [])

  // 送信はPromiseを返す（失敗はthrowされ、ダイアログがフィールドエラーに紐付ける）。
  // 手動追加・編集は必ず確認ダイアログを一枚挟んでから実行する（Excel取り込みの
  // 適用と同じconfirmStateの仕組みを流用）。「キャンセル」を押した場合はこの
  // Promiseを解決させず、フォームダイアログを開いたまま何も起きないようにする
  // （AccountAuthFormDialog側はawaitしたまま止まるだけで、閉じたりエラー表示は
  // されない。フォームは編集可能なまま残る）
  const handleSubmit = (input: AccountAuthInput): Promise<void> => {
    return new Promise((resolve, reject) => {
      const message = editTarget
        ? `「${input.accountName}」の内容を更新します。よろしいですか？`
        : `「${input.accountName}」を追加します。よろしいですか？`
      setConfirmState({
        message,
        onConfirm: () => {
          const action = editTarget ? update({ id: editTarget.id, input, target }).unwrap() : create([input]).unwrap()
          action.then(() => resolve()).catch((e) => reject(e))
        },
      })
    })
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
  //     message: `「${row.accountName}」を削除しますか？`,
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
    ...TEXT_COLS.map((c): GridColDef<AccountAuth> => {
      // 【全列でrenderCellを指定する】DataGridはrenderCellが無い列だと、
      // セルにネイティブのtitle属性を付けてしまい、ブラウザ標準の飾り気の
      // ないツールチップになる。どの列も溢れうる（ユーザー名・販売会社名等）
      // ため、全列にMUIのTooltipを適用する
      // password列は実体がSHA-1ハッシュ（平文ではない）とはいえ、見せても
      // 運用上の意味が無く不要な情報露出になるため、常にアスタリスクで伏せる。
      // 値の有無だけ見せ、ハッシュの長さ自体も漏らさないよう固定文字数にする
      if (c.key === 'password') {
        return {
          field: c.key,
          headerName: c.label,
          minWidth: c.width,
          flex: c.width,
          sortable: false,
          valueFormatter: (value) => (value ? '********' : ''),
          renderCell: (params) => <OverflowTooltipCell value={String(params.formattedValue ?? '')} />,
        }
      }
      return {
        field: c.key,
        headerName: c.label,
        minWidth: c.width,
        flex: c.width,
        valueFormatter: (value) => (value === null || value === undefined ? '' : value),
        renderCell: (params) => <OverflowTooltipCell value={String(params.formattedValue ?? '')} />,
      }
    }),
    {
      field: 'non_sync',
      headerName: '診断対象外',
      minWidth: 110,
      flex: 110,
      sortable: false,
      renderCell: (params) => (
        <Chip label={params.row.non_sync ? '対象外' : '通常'} color={params.row.non_sync ? 'warning' : 'default'} size="small" />
      ),
    },
    {
      field: 'delfg',
      headerName: '状態',
      minWidth: 110,
      flex: 110,
      sortable: false,
      renderCell: (params) =>
        params.row.delfg
          ? <Chip label="削���済み" color="error" size="small" />
          : <Chip label="有効" color="success" variant="outlined" size="small" />,
    },
  ], [openEdit])

  return (
    <Box sx={{ p: 3 }}>
      {/* 1段目：ページタイトル（左）とページ全体の操作（右） */}
      <Stack
        direction="row"
        useFlexGap
        sx={{ mb: 2.5, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}
      >
        <Stack direction="row" useFlexGap sx={{ alignItems: 'center', gap: 2 }}>
          <Typography variant="h1" sx={{ m: 0 }}>アカウント認証テーブル</Typography>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={target}
            onChange={handleTargetChange}
            aria-label="対象アカウントの切り替え"
          >
            <ToggleButton value="normal">通常</ToggleButton>
            <ToggleButton value="diag">DIAG</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
        {!isDiag && (
          <Stack direction="row" useFlexGap sx={{ alignItems: 'center', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<UploadFileIcon />}
              loading={previewLoading}
              loadingPosition="start"
              onClick={() => previewFileRef.current?.click()}
            >
              {previewLoading ? '差分を計算中…' : 'Excel取り込み（差分プレビュー）'}
            </Button>
            <Tooltip title="除外リスト管理">
              <IconButton
                size="small"
                aria-label="除外リスト管理"
                onClick={() => setExcludeListDialogOpen(true)}
                sx={{ color: 'text.secondary', '&:hover': { bgcolor: 'action.hover' } }}
              >
                <PlaylistRemoveIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="比較前値置換ルール管理">
              <IconButton
                size="small"
                aria-label="比較前値置換ルール管理"
                onClick={() => setNormalizeRulesDialogOpen(true)}
                sx={{ color: 'text.secondary', '&:hover': { bgcolor: 'action.hover' } }}
              >
                <FindReplaceIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>新規追加</Button>
            <input ref={previewFileRef} type="file" accept=".xlsx,.xls" hidden onChange={handlePreviewFile} />
          </Stack>
        )}
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{(error as Error).message}</Alert>}

      {/* 2段目：表専用のツールバー。左に絞り込み、右に件数と列表示設定。
          列表示設定はアイコンのみで置き、ツールチップで用途を補う（2026-08-05） */}
      <Stack direction="row" useFlexGap sx={{ mb: 1, alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <FilterInline
          numberValue={numberSearch}
          accountNameValue={accountNameSearch}
          onNumberChange={setNumberSearch}
          onAccountNameChange={setAccountNameSearch}
        />
        <Typography
          variant="body2"
          color="text.secondary"
          aria-live="polite"
          sx={{ ml: 'auto', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
        >
          {isFiltering
            ? `${filteredData?.length ?? 0} / ${data?.length ?? 0} 件`
            : `${data?.length ?? 0} 件`}
        </Typography>
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

      <Box sx={{ height: '70vh' }}>
        <DataGrid
          apiRef={apiRef}
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
          // 総件数は表上部のツールバーで別途表示する
          initialState={{
            pagination: { paginationModel: { pageSize: -1 } },
            // 水平スクロールを減らすため、優先度が低い列はデフォルト非表示。
            // 表右上の列表示設定ボタン（列パネル）でいつでも表示に戻せる
            columns: {
              columnVisibilityModel: {
                reg_date: false, upd_date: false,
                company_store_cd: false, company_store_branch_num: false, store_cd: false,
              },
            },
          }}
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

      <AccountAuthFormDialog
        open={dialogOpen}
        target={editTarget}
        suggestedNumber={suggestedNumber}
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

      <ImportExcludeNumbersDialog
        open={excludeListDialogOpen}
        onClose={() => setExcludeListDialogOpen(false)}
      />
      <ImportValueNormalizeRulesDialog
        open={normalizeRulesDialogOpen}
        onClose={() => setNormalizeRulesDialogOpen(false)}
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
