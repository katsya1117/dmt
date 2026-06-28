import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { masterHandlers } from '../../mocks/masterHandlers'
import { VehicleSelectTable } from './VehicleSelectTable'
import type { Vehicle } from '../../api/master'

function Harness() {
  const [selected, setSelected] = useState<Vehicle | null>(null)
  return (
    <div style={{ width: 480, padding: 16 }}>
      <VehicleSelectTable
        selectedId={selected?.id ?? null}
        onSelect={(_id, v) => setSelected(v)}
      />
      <p>選択中: {selected ? selected.name : '（なし）'}</p>
    </div>
  )
}

const meta: Meta<typeof Harness> = {
  title: 'select/VehicleSelectTable',
  component: Harness,
  parameters: { msw: { handlers: masterHandlers } },
  decorators: [
    (Story) => {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      return <QueryClientProvider client={qc}><Story /></QueryClientProvider>
    },
  ],
}
export default meta

type Story = StoryObj<typeof Harness>

// 客先DB（MSWモック）から車種を取得して単一選択
export const Default: Story = {}
