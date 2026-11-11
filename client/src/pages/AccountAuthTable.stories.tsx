import type { Meta, StoryObj } from '@storybook/react-vite'
import { Provider as ReduxProvider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
// import { expect, within } from 'storybook/test' // DIAGストーリー無効化中につき未使用
import { createStore } from '../store'
import { accountAuthHandlers, resetAccountAuthMock } from '../mocks/accountAuthHandlers'
import { importExcludeListHandlers, resetImportExcludeNumbersMock } from '../mocks/importExcludeListHandlers'
import { importValueNormalizeRulesHandlers, resetImportValueNormalizeRulesMock } from '../mocks/importValueNormalizeRulesHandlers'
import AccountAuthTable from './AccountAuthTable'

const meta: Meta<typeof AccountAuthTable> = {
  title: 'pages/AccountAuthTable',
  component: AccountAuthTable,
  parameters: {
    layout: 'fullscreen',
    // 除外リスト・正規化ルールの管理ボタンをツールバーに常設したため
    // （2026-10-26、ImportDiffDialogから移設）、この画面のマウント時点で
    // 両方のクエリが走る。ハンドラも合わせて登録する
    msw: { handlers: [...accountAuthHandlers, ...importExcludeListHandlers, ...importValueNormalizeRulesHandlers] },
  },
  // BrowserRouterは起動時のURLを読むため、ストーリー間でURLが持ち越されないよう
  // 毎回クエリなしに戻す（DIAGストーリーは自身のloadersで ?target=diag にする）
  loaders: [() => { window.history.replaceState(null, '', '/') }],
  decorators: [
    (Story) => {
      // ストーリーごとにモック状態とRTK Queryキャッシュ（＝store）を初期化
      resetAccountAuthMock()
      resetImportExcludeNumbersMock()
      resetImportValueNormalizeRulesMock()
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

// 【2026-11-12 DIAG機能無効化に伴いコメントアウト】DIAGアカウントの情報は
// このアプリ・客先の他システムいずれからも参照されないことが判明し、通常⇔DIAG
// 切り替え画面自体をAccountAuthTable.tsx側でコード上無効化した（targetは常に
// 'normal'に固定）。このストーリーはURLクエリで?target=diagを模してDIAG表示を
// 確認するものだったが、今はtargetが固定なので意味を持たない。画面を復活させる
// 時はAccountAuthTable.tsxの該当コメントアウトと合わせてこれも復活させる
// export const DiagTarget: Story = {
//   loaders: [() => { window.history.replaceState(null, '', '/?target=diag') }],
//   play: async ({ canvasElement }) => {
//     const canvas = within(canvasElement)
//     await expect(await canvas.findByText('diag-only01')).toBeInTheDocument()
//     await expect(canvas.queryByRole('button', { name: /新規追加/ })).not.toBeInTheDocument()
//     await expect(canvas.queryByRole('button', { name: /Excel取り込み/ })).not.toBeInTheDocument()
//   },
// }
