import { SelectableTable, type Column } from './SelectableTable'
import { masterApi } from '../../store/services/masterApi'
import type { Vehicle } from '../../api/master'

const columns: Column<Vehicle>[] = [
  { label: '車種コード', render: (v) => v.code, width: 120 },
  { label: '車種名', render: (v) => v.name },
]

type Props = {
  selectedId: string | null
  onSelect: (id: string, vehicle: Vehicle) => void
  /** データを外から差し込む場合（dbd取り込み等）。未指定なら客先DBから取得 */
  rows?: Vehicle[]
}

/** 車種一覧の単一選択テーブル。複数画面で共通利用する。 */
export function VehicleSelectTable({ selectedId, onSelect, rows }: Props) {
  const query = masterApi.useVehiclesQuery()
  const data = rows ?? query.data ?? []

  return (
    <SelectableTable
      rows={data}
      columns={columns}
      getRowId={(v) => v.id}
      selectedId={selectedId}
      onSelect={onSelect}
      loading={rows ? false : query.isLoading}
      error={rows ? undefined : query.error ? (query.error as Error).message : undefined}
      searchText={(v) => `${v.code} ${v.name}`}
      searchPlaceholder="車種を絞り込み..."
      emptyText="車種がありません"
    />
  )
}
