import { Body, Controller, Post, Response, Route, Tags } from 'tsoa'
import {
  listAllAccountAuth,
  applyAccountAuthImport,
  type AccountAuthInput,
  type ApplyImportResult,
} from '../repositories/accountAuth'
import { computeImportDiff, validateImportRecords, type ImportDiff } from '../services/accountAuthDiff'

interface PreviewBody {
  records: AccountAuthInput[]
}

interface ImportErrorResponse {
  error: string
  errors?: string[]
}

// ┌─────────────────────────────────────────────────────────────┐
// │ アカウント認証 Excel取り込み（差分レビュー方式）              │
// │ preview: 差分を計算して返すだけ。DBへ書き込まない（安全）。   │
// │ apply: 人の承認後に呼ぶ。DB再読込→差分再計算→反映（安全）。   │
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

  /** 差分を承認後に適用。DBを再読込し差分を再計算してから反映する（プレビュー後のDB変化に追従） */
  @Post('apply')
  @Response<ImportErrorResponse>(400, '検証エラー')
  public async apply(@Body() body: PreviewBody): Promise<ApplyImportResult | ImportErrorResponse> {
    const errors = validateImportRecords(body.records)
    if (errors.length > 0) {
      this.setStatus(400)
      return { error: '検証エラーがあります', errors }
    }
    const current = listAllAccountAuth()
    const diff = computeImportDiff(body.records, current)
    return applyAccountAuthImport({
      added: diff.added,
      changed: diff.changed.map((c) => ({ after: c.after })),
      deleted: diff.deleted,
      restored: diff.restored,
    })
  }
}
