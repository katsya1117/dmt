import { useMemo, useState, type ReactNode } from 'react'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import Paper from '@mui/material/Paper'
import Radio from '@mui/material/Radio'
import TextField from '@mui/material/TextField'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

export type Column<T> = {
  /** 見出し */
  label: string
  /** セルの内容。文字列を返すかReactNodeを返す */
  render: (row: T) => ReactNode
  width?: number | string
}

type Props<T> = {
  rows: T[]
  columns: Column<T>[]
  /** 各行の一意キーを取り出す */
  getRowId: (row: T) => string
  /** 選択中の行ID（単一選択） */
  selectedId: string | null
  onSelect: (id: string, row: T) => void
  loading?: boolean
  error?: string
  /** 検索ボックスを出す場合、検索対象の文字列を返す関数 */
  searchText?: (row: T) => string
  /** 検索プレースホルダ */
  searchPlaceholder?: string
  /** 空のときのメッセージ */
  emptyText?: string
}

/**
 * 単一選択の汎用テーブル。車種・型式など、一覧から1件選ぶUIを共通化する。
 * データ取得は関与せず、渡された rows を表示するだけ（プレゼンテーショナル）。
 * → データ源（客先DB / dbd取り込み）が何であっても再利用できる。
 */
export function SelectableTable<T>({
  rows,
  columns,
  getRowId,
  selectedId,
  onSelect,
  loading,
  error,
  searchText,
  searchPlaceholder = '絞り込み...',
  emptyText = 'データがありません',
}: Props<T>) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!searchText || !query.trim()) return rows
    const q = query.trim().toLowerCase()
    return rows.filter((r) => searchText(r).toLowerCase().includes(q))
  }, [rows, query, searchText])

  return (
    <Box>
      {searchText && (
        <TextField
          size="small"
          fullWidth
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          sx={{ mb: 1 }}
        />
      )}

      {error && <Typography color="error" sx={{ mb: 1 }}>{error}</Typography>}

      <TableContainer component={Paper} sx={{ maxHeight: 360 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" />
              {columns.map((col, i) => (
                <TableCell key={i} sx={{ width: col.width }}>{col.label}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={columns.length + 1}>読み込み中...</TableCell></TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={columns.length + 1}>{emptyText}</TableCell></TableRow>
            )}
            {!loading && filtered.map((row) => {
              const id = getRowId(row)
              const selected = id === selectedId
              return (
                <TableRow
                  key={id}
                  hover
                  selected={selected}
                  onClick={() => onSelect(id, row)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell padding="checkbox">
                    <Radio checked={selected} size="small" tabIndex={-1} />
                  </TableCell>
                  {columns.map((col, i) => (
                    <TableCell key={i}>{col.render(row)}</TableCell>
                  ))}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}
