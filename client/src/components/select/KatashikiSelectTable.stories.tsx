import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Provider as ReduxProvider } from 'react-redux'
import { createStore } from '../../store'
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
    // ストーリーごとに独立したstore（＝RTK Queryキャッシュ）を注入する
    (Story) => <ReduxProvider store={createStore()}><Story /></ReduxProvider>,
  ],
}
export default meta

type Story = StoryObj<typeof Harness>

// 全型式を表示
export const AllKatashiki: Story = { args: { vehicleId: undefined } }

// 車種V001(ABC)で絞り込み
export const FilteredByVehicle: Story = { args: { vehicleId: 'V001' } }
