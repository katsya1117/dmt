import { Controller, Post, Response, Route, Tags, UploadedFile } from 'tsoa'
import {
  listAllAccountAuth,
  applyAccountAuthImport,
  type ApplyImportResult,
} from '../repositories/accountAuth'
import { computeImportDiff, validateImportRecords, type ImportDiff } from '../services/accountAuthDiff'
import { parseAccountAuthExcelBuffer } from '../services/parseAccountAuthExcel'

interface ImportErrorResponse {
  error: string
  errors?: string[]
}

// ┌─────────────────────────────────────────────────────────────┐
// │ アカウント認証 Excel取り込み（差分レビュー方式）              │
// │ preview: 差分を計算して返すだけ。DBへ書き込まない（安全）。   │
// │ apply: 人の承認後に呼ぶ。DB再読込→差分再計算→反映（安全）。   │
// │ パースはサーバー側で行う（ファイルをmultipartで受け取る）。   │
// │ 理由：20000行規模をクライアント側でパースするとブラウザの     │
// │ メインスレッドが長時間ブロックされることを実測で確認したため  │
// │ （2026-07-10）。マスタ全件・差分ファイルどちらも同じ口。      │
// └─────────────────────────────────────────────────────────────┘
@Route('account-auth/import')
@Tags('アカウント認証 取り込み')
export class AccountAuthImportController extends Controller {
  /** 差分プレビュー（書き込みなし）。ファイルにある行だけ判定する */
  @Post('preview')
  public async preview(@UploadedFile() file: Express.Multer.File): Promise<ImportDiff> {
    const records = await parseAccountAuthExcelBuffer(file.buffer)
    const current = listAllAccountAuth() // delfg=1含む全件（リストア判定のため）
    return computeImportDiff(records, current)
  }

  /** 差分を承認後に適用。DBを再読込し差分を再計算してから反映する（プレビュー後のDB変化に追従） */
  @Post('apply')
  @Response<ImportErrorResponse>(400, '検証エラー')
  public async apply(@UploadedFile() file: Express.Multer.File): Promise<ApplyImportResult | ImportErrorResponse> {
    const records = await parseAccountAuthExcelBuffer(file.buffer)
    const current = listAllAccountAuth()
    const errors = validateImportRecords(records, current)
    if (errors.length > 0) {
      this.setStatus(400)
      return { error: '検証エラーがあります', errors }
    }
    const diff = computeImportDiff(records, current)
    return applyAccountAuthImport({
      added: diff.added,
      changed: diff.changed.map((c) => ({ after: c.after })),
      deleted: diff.deleted.map((d) => ({ username: d.username })),
      restored: diff.restored.map((d) => ({ username: d.username })),
    })
  }
}
