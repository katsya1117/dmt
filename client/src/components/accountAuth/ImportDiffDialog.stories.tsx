import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import Button from '@mui/material/Button'
import { ImportDiffDialog } from './ImportDiffDialog'
import type { ImportDiff } from '../../api/accountAuthImport'
import type { AccountAuth } from '../../api/accountAuth'

const ts = '2026-07-01 09:00:00'

const before: AccountAuth = {
  id: 10, accountName: 'dealer010', password: 'hash-before', comment: '東日本エリア担当', number: 1010,
  submission_date: '2024-04-01', regist_date: '2024-04-05',
  company_cd: 'C01', company_name: '北日本販売', company_store_cd: 'CS01', company_store_branch_num: '01',
  non_sync: false, store_cd: 'S001', store_name: '札幌中央店', reg_date: ts, upd_date: ts, delfg: false,
}

const deletedBefore: AccountAuth = {
  ...before, id: 11, accountName: 'dealer011', number: 1011, comment: null, delfg: false,
}

const restoredBefore: AccountAuth = {
  ...before, id: 12, accountName: 'dealer012', number: 1012, comment: '2026/06/01 削除', delfg: true,
}

// 実際にサーバー(accountAuthDiff.ts)が生成する自動コメントの見た目を再現したサンプル。
// 備考は運用担当者の手入力＋自動追記で長くなりがちなので、その様子も分かるようにする
const sampleDiff: ImportDiff = {
  added: [
    {
      line: 1,
      record: {
        accountName: 'dealer020', password: 'newpass', comment: null, number: 1020,
        submission_date: '2026-07-01', regist_date: '2026-07-02',
        company_cd: 'C03', company_name: '西日本販売', company_store_cd: 'CS03', company_store_branch_num: '01',
        non_sync: false, store_cd: 'S003', store_name: '大阪中央店', delfg: false,
      },
    },
  ],
  changed: [
    {
      line: 2,
      accountName: before.accountName,
      before,
      after: {
        accountName: before.accountName, password: before.password, number: before.number,
        comment: `${before.comment} 2026/07/31 販売会社変更 北日本販売→南日本販売、店舗CD枝番変更 01→02`,
        submission_date: before.submission_date, regist_date: before.regist_date,
        company_cd: before.company_cd, company_name: '南日本販売', company_store_cd: before.company_store_cd,
        company_store_branch_num: '02', non_sync: before.non_sync, store_cd: before.store_cd,
        store_name: before.store_name, delfg: false,
      },
      changedFields: ['company_name', 'company_store_branch_num'],
    },
  ],
  deleted: [
    {
      line: 3,
      accountName: deletedBefore.accountName,
      before: deletedBefore,
      after: { ...deletedBefore, comment: '2026/07/31 削除', delfg: true },
    },
  ],
  restored: [
    {
      line: 4,
      accountName: restoredBefore.accountName,
      before: restoredBefore,
      after: { ...restoredBefore, comment: `${restoredBefore.comment} 2026/07/31 再登録`, delfg: false },
    },
  ],
  unchangedCount: 3,
  validationErrors: [],
}

// 開閉確認用ラッパー
function Harness({ diff }: { diff: ImportDiff }) {
  const [open, setOpen] = useState(true)
  return (
    <div style={{ padding: 16 }}>
      <Button variant="outlined" onClick={() => setOpen(true)}>プレビューを開く</Button>
      <ImportDiffDialog open={open} diff={diff} onClose={() => setOpen(false)} onApply={() => {}} applying={false} />
    </div>
  )
}

const meta: Meta<typeof Harness> = {
  title: 'accountAuth/ImportDiffDialog',
  component: Harness,
}
export default meta

type Story = StoryObj<typeof Harness>

// 追加/変更/削除/リストアが一通り混在する差分（自動追記コメントの見た目も確認できる）
export const Default: Story = { args: { diff: sampleDiff } }

// DBに無いaccountNameが、Excel上は解約日ありの状態（delfg=true）で来たケース。
// 理論上は初回のExcel取り込みでのみ起こる（初回はリストア検知のため削除済み
// 行もそのままDBへ登録する必要がある）。区分チップは他の追加行と同じ「追加」の
// ままだが、「状態」列が「削除済み」になり、有効な新規登録と見分けが付く
export const AddedAlreadyDeleted: Story = {
  args: {
    diff: {
      ...sampleDiff,
      added: [
        ...sampleDiff.added,
        {
          line: 5,
          record: {
            accountName: 'dealer030', password: 'newpass', comment: null, number: 1030,
            submission_date: '2020-04-01', regist_date: '2020-04-02',
            company_cd: 'C04', company_name: '中日本販売', company_store_cd: 'CS04', company_store_branch_num: '01',
            non_sync: false, store_cd: 'S004', store_name: '名古屋中央店', delfg: true,
          },
        },
      ],
    },
  },
}

// 検証エラーがあり適用ボタンが無効化されているケース。
// 追加行（dealer020）と変更行（dealer010）がエラー対象＝一覧でその行が赤くハイライトされる。
// 「N行目」ではなくNo.（管理番号）でユーザーに行を示す
export const WithValidationErrors: Story = {
  args: {
    diff: {
      ...sampleDiff,
      validationErrors: [
        { line: 1, number: 1020, message: 'No.1020が重複しています（同じNo.の行: dealer010）' },
        { line: 2, number: 1020, message: 'No.1020が重複しています（同じNo.の行: dealer020）' },
      ],
    },
  },
}

// 変更なし（プレビューはしたが差分ゼロ）
export const NoChanges: Story = {
  args: {
    diff: {
      added: [], changed: [], deleted: [], restored: [],
      unchangedCount: 5, validationErrors: [],
    },
  },
}
