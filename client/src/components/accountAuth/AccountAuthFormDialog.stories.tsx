import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import Button from '@mui/material/Button'
import { AccountAuthFormDialog } from './AccountAuthFormDialog'
import type { AccountAuth, AccountAuthInput } from '../../api/accountAuth'

const sampleRow: AccountAuth = {
  id: 2,
  account_id: 'dealer002',
  auth_key: 'KEY-EF56-GH78',
  valid_until: '2027-03-31',
  enabled: 1,
  updated_at: '2026-06-25 08:03:57',
}

// 開閉とsubmit内容の確認用ラッパー
function Harness({ target }: { target: AccountAuth | null }) {
  const [open, setOpen] = useState(true)
  const [submitted, setSubmitted] = useState<AccountAuthInput | null>(null)
  const handleSubmit = (input: AccountAuthInput) => { setSubmitted(input); setOpen(false) }
  return (
    <div style={{ padding: 16 }}>
      <Button variant="outlined" onClick={() => setOpen(true)}>ダイアログを開く</Button>
      {submitted && <pre>submit: {JSON.stringify(submitted)}</pre>}
      <AccountAuthFormDialog
        open={open}
        target={target}
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit}
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
