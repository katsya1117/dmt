import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
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
      // ストーリーごとにモック状態とクエリキャッシュを初期化
      resetAccountAuthMock()
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      return (
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <Story />
          </BrowserRouter>
        </QueryClientProvider>
      )
    },
  ],
}
export default meta

type Story = StoryObj<typeof AccountAuthTable>

// 一覧表示・新規追加・編集・Excel取り込み（差分プレビュー）が、MSW上で実際に動く
export const Default: Story = {}
