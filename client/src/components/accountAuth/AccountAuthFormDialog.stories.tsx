import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import Button from '@mui/material/Button'
import { AccountAuthFormDialog } from './AccountAuthFormDialog'
import type { AccountAuth, AccountAuthInput } from '../../api/accountAuth'

const sampleRow: AccountAuth = {
  id: 2, username: 'dealer002', password: 'pw-002', comment: null, number: 1002,
  submission_date: '2024-05-10', regist_date: '2024-05-12',
  company_cd: 'C02', company_name: '東日本販売', company_store_cd: 'CS02', company_store_branch_num: '03',
  non_sync: true, store_cd: 'S002', store_name: '仙台駅前店',
  reg_date: '2026-07-01 09:00:00', upd_date: '2026-07-01 09:00:00', delfg: false,
}

// 開閉とsubmit内容の確認用ラッパー
function Harness({ target }: { target: AccountAuth | null }) {
  const [open, setOpen] = useState(true)
  const [submitted, setSubmitted] = useState<AccountAuthInput | null>(null)
  const handleSubmit = async (input: AccountAuthInput) => { setSubmitted(input) }
  return (
    <div style={{ padding: 16 }}>
      <Button variant="outlined" onClick={() => setOpen(true)}>ダイアログを開く</Button>
      {submitted && <pre>submit: {JSON.stringify(submitted)}</pre>}
      <AccountAuthFormDialog
        open={open}
        target={target}
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit}
        onSuccess={() => setOpen(false)}
      />
    </div>
  )
}

const meta: Meta<typeof Harness> = {
  title: 'accountAuth/AccountAuthFormDialog',
  component: Harness,
}
export default meta

type Story = StoryObj<typeof Harness>

// 新規追加（空フォーム＋バリデーション）
export const Add: Story = { args: { target: null } }

// 編集（既存値がプリセットされる）
export const Edit: Story = { args: { target: sampleRow } }
