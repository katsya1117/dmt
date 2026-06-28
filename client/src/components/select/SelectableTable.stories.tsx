import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { SelectableTable, type Column } from './SelectableTable'

type Fruit = { id: string; name: string; price: number }

const fruits: Fruit[] = [
  { id: 'a', name: 'りんご', price: 120 },
  { id: 'b', name: 'みかん', price: 80 },
  { id: 'c', name: 'ぶどう', price: 300 },
]

const columns: Column<Fruit>[] = [
  { label: '名前', render: (f) => f.name },
  { label: '価格', render: (f) => `¥${f.price}` },
]

// 選択状態を保持する確認用ラッパー
function Harness({ withSearch }: { withSearch?: boolean }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  return (
    <div style={{ width: 420, padding: 16 }}>
      <SelectableTable
        rows={fruits}
        columns={columns}
        getRowId={(f) => f.id}
        selectedId={selectedId}
        onSelect={(id) => setSelectedId(id)}
        searchText={withSearch ? (f) => f.name : undefined}
      />
      <p>選択中ID: {selectedId ?? '（なし）'}</p>
    </div>
  )
}

const meta: Meta<typeof Harness> = {
  title: 'select/SelectableTable',
  component: Harness,
}
export default meta

type Story = StoryObj<typeof Harness>

// 基本：クリックで単一選択
export const Default: Story = { args: { withSearch: false } }

// 検索ボックスつき
export const WithSearch: Story = { args: { withSearch: true } }
