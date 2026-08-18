import { Controller, FormField, Post, Response, Route, Tags, UploadedFile } from 'tsoa'
import {
  listAllAccountAuth,
  applyAccountAuthImport,
  type ApplyImportResult,
} from '../repositories/accountAuth'
import { computeImportDiff, validateImportRecords, type ImportDiff, type ValidationError } from '../services/accountAuthDiff'
import { parseAccountAuthExcelBuffer } from '../services/parseAccountAuthExcel'

interface ImportErrorResponse {
  error: string
  errors?: ValidationError[]
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
  /** 差分プレビュー（書き込みなし）。ファイルにある行だけ判定する。
   *  検証エラーがあっても差分自体は返す（applyで拒否されることを事前に知らせるため） */
  @Post('preview')
  public async preview(@UploadedFile() file: Express.Multer.File): Promise<ImportDiff> {
    const records = await parseAccountAuthExcelBuffer(file.buffer)
    const current = await listAllAccountAuth() // delfg=1含む全件（リストア判定のため）
    const diff = computeImportDiff(records, current)
    diff.validationErrors = validateImportRecords(records)
    return diff
  }

  /** 差分を承認後に適用。DBを再読込し差分を再計算してから反映する（プレビュー後のDB変化に追従）。
   *  commentOverrides：プレビュー画面で自動生成コメントを手動編集した場合、
   *  `{ 行番号: 編集後の文字列 }` のJSON文字列を渡すと、再計算後の該当行の
   *  コメントをその内容で上書きする。DBを信用してファイルから作り直すという
   *  安全設計（apply時に差分を再計算する）はそのまま維持し、コメント編集内容
   *  だけを横に添えて運ぶ。行番号はファイル内の行位置なので、preview時と同じ
   *  ファイルをそのままapplyに渡す前提（差し替えた場合は行がズレるため対応外） */
  @Post('apply')
  @Response<ImportErrorResponse>(400, '検証エラー')
  public async apply(
    @UploadedFile() file: Express.Multer.File,
    @FormField() commentOverrides?: string
  ): Promise<ApplyImportResult | ImportErrorResponse> {
    const records = await parseAccountAuthExcelBuffer(file.buffer)
    const errors = validateImportRecords(records)
    if (errors.length > 0) {
      this.setStatus(400)
      return { error: '検証エラーがあります', errors }
    }
    const current = await listAllAccountAuth()
    const diff = computeImportDiff(records, current)

    const overrides: Record<number, string> = commentOverrides ? JSON.parse(commentOverrides) : {}
    if (Object.keys(overrides).length > 0) {
      for (const a of diff.added) {
        const o = overrides[a.line]
        if (o !== undefined) a.record = { ...a.record, comment: o }
      }
      for (const c of diff.changed) {
        const o = overrides[c.line]
        if (o !== undefined) c.after = { ...c.after, comment: o }
      }
      for (const d of diff.deleted) {
        const o = overrides[d.line]
        if (o !== undefined) d.after = { ...d.after, comment: o }
      }
      for (const r of diff.restored) {
        const o = overrides[r.line]
        if (o !== undefined) r.after = { ...r.after, comment: o }
      }
    }

    return await applyAccountAuthImport({
      added: diff.added.map((a) => a.record),
      changed: diff.changed.map((c) => ({ id: c.before.id, after: c.after })),
      deleted: diff.deleted.map((d) => ({ id: d.before.id, comment: d.after.comment ?? '' })),
      restored: diff.restored.map((r) => ({ id: r.before.id, comment: r.after.comment ?? '' })),
    })
  }
}
