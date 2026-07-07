import { Body, Controller, Post, Route, Tags } from 'tsoa'
import { listAllAccountAuth, type AccountAuthInput } from '../repositories/accountAuth'
import { computeImportDiff, type ImportDiff } from '../services/accountAuthDiff'

interface PreviewBody {
  records: AccountAuthInput[]
}

// ┌─────────────────────────────────────────────────────────────┐
// │ アカウント認証 Excel取り込み（差分レビュー方式）              │
// │ preview: 差分を計算して返すだけ。DBへ書き込まない（安全）。   │
// │ apply は次段階で追加予定。                                    │
// └─────────────────────────────────────────────────────────────┘
@Route('account-auth/import')
@Tags('アカウント認証 取り込み')
export class AccountAuthImportController extends Controller {
  /** 差分プレビュー（書き込みなし）。ファイルにある行だけ判定する */
  @Post('preview')
  public async preview(@Body() body: PreviewBody): Promise<ImportDiff> {
    const current = listAllAccountAuth() // delfg=1含む全件（リストア判定のため）
    return computeImportDiff(body.records, current)
  }
}
