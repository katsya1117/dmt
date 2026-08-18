// applyAccountAuthImport の delete/restore が他カラムを壊さないかの一時確認スクリプト。
// 確認後は削除してよい

import { applyAccountAuthImport, listAllAccountAuth } from '../repositories/accountAuth'

async function main() {
  const before = await listAllAccountAuth()
  const target = before.find((r) => r.id === 3)
  if (!target) throw new Error('id=3 が見つかりません（先にcreateしておくこと）')
  console.log('--- before delete ---', target)

  await applyAccountAuthImport({
    added: [],
    changed: [],
    deleted: [{ id: 3, comment: 'テスト削除コメント' }],
    restored: [],
  })

  const afterDelete = (await listAllAccountAuth()).find((r) => r.id === 3)
  console.log('--- after delete (他のカラムが消えていないか) ---', afterDelete)

  await applyAccountAuthImport({
    added: [],
    changed: [],
    deleted: [],
    restored: [{ id: 3, comment: 'テストリストアコメント' }],
  })
  const afterRestore = (await listAllAccountAuth()).find((r) => r.id === 3)
  console.log('--- after restore ---', afterRestore)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
