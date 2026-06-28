import { SelectableTable, type Column } from './SelectableTable'
import { useKatashiki } from '../../hooks/useMaster'
import type { Katashiki } from '../../api/master'

const columns: Column<Katashiki>[] = [
  { label: '型式コード', render: (k) => k.code, width: 120 },
  { label: '年式', render: (k) => k.year, width: 100 },
  { label: '型式名', render: (k) => k.name },
]

type Props = {
  selectedId: string | null
  onSelect: (id: string, katashiki: Katashiki) => void
  /** 車種で絞り込む場合に指定。未指定なら全型式 */
  vehicleId?: string
  /** データを外から差し込む場合（dbd取り込み等）。未指定なら客先DBから取得 */
  rows?: Katashiki[]
}

/** 型式一覧の単一選択テーブル。車種で絞り込み可能。複数画面で共通利用する。 */
export function KatashikiSelectTable({ selectedId, onSelect, vehicleId, rows }: Props) {
  const query = useKatashiki(rows ? undefined : vehicleId)
  const data = rows ?? query.data ?? []

  return (
    <SelectableTable
      rows={data}
      columns={columns}
      getRowId={(k) => k.id}
      selectedId={selectedId}
      onSelect={onSelect}
      loading={rows ? false : query.isLoading}
      error={rows ? undefined : query.error ? (query.error as Error).message : undefined}
      searchText={(k) => `${k.code} ${k.year} ${k.name}`}
      searchPlaceholder="型式を絞り込み..."
      emptyText="型式がありません"
    />
  )
}
