import type { Meta, StoryObj } from '@storybook/react-vite'
import { Provider as ReduxProvider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { createStore } from '../store'
import { accountAuthHandlers, resetAccountAuthMock } from '../mocks/accountAuthHandlers'
import AccountAuthTable from './AccountAuthTable'

const meta: Meta<typeof AccountAuthTable> = {
  title: 'pages/AccountAuthTable',
  component: AccountAuthTable,
  parameters: {
    layout: 'fullscreen',
    msw: { handlers: accountAuthHandlers },
  },
  decorators: [
    (Story) => {
      // ストーリーごとにモック状態とRTK Queryキャッシュ（＝store）を初期化
      resetAccountAuthMock()
      return (
        <ReduxProvider store={createStore()}>
          <BrowserRouter>
            <Story />
          </BrowserRouter>
        </ReduxProvider>
      )
    },
  ],
}
export default meta

type Story = StoryObj<typeof AccountAuthTable>

// 一覧表示・新規追加・編集・Excel取り込み（差分プレビュー）が、MSW上で実際に動く
export const Default: Story = {}
