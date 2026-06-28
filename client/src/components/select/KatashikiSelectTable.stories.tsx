import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { masterHandlers } from '../../mocks/masterHandlers'
import { KatashikiSelectTable } from './KatashikiSelectTable'
import type { Katashiki } from '../../api/master'

function Harness({ vehicleId }: { vehicleId?: string }) {
  const [selected, setSelected] = useState<Katashiki | null>(null)
  return (
    <div style={{ width: 540, padding: 16 }}>
      <KatashikiSelectTable
        vehicleId={vehicleId}
        selectedId={selected?.id ?? null}
        onSelect={(_id, k) => setSelected(k)}
      />
      <p>選択中: {selected ? selected.name : '（なし）'}</p>
    </div>
  )
}

const meta: Meta<typeof Harness> = {
  title: 'select/KatashikiSelectTable',
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

// 全型式を表示
export const AllKatashiki: Story = { args: { vehicleId: undefined } }

// 車種V001(ABC)で絞り込み
export const FilteredByVehicle: Story = { args: { vehicleId: 'V001' } }
