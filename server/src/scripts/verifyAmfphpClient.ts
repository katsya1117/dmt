// amfphpClient.ts の疎通確認用スクリプト（開発時の手動実行専用。テストコードではない）。
// mock/php-server（docker compose up -d php-server）を起動した状態で
//   yarn verify:amfphp
// を実行する

import { callAmfphpService } from '../services/amfphpClient'

async function main() {
  const targetTableId = 0 // t_inet_user_auth

  console.log('--- load ---')
  const rows = await callAmfphpService('DbManagerTInetUserAuth', 'load', [targetTableId])
  console.log(rows)

  console.log('--- update (INSERT) ---')
  const insertResult = await callAmfphpService('DbManagerTInetUserAuth', 'update', [
    targetTableId,
    [{ updatemark: 'INSERT', username: `verify-${Date.now()}`, password: 'pw', comment: 'amfphpClient疎通確認', non_sync: false, delfg: false }],
  ])
  console.log(insertResult)

  console.log('--- load (INSERT後) ---')
  const rowsAfter = await callAmfphpService('DbManagerTInetUserAuth', 'load', [targetTableId])
  console.log(rowsAfter)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
