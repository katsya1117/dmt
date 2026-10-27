import { Controller, FormField, Post, Response, Route, Tags, UploadedFile } from 'tsoa'
import {
  listAllAccountAuth,
  listManagedAuthorities,
  applyAccountAuthImport,
  assertAccountAuthListLooksValid,
  type ApplyImportResult,
} from '../repositories/accountAuth'
import { computeImportDiff, redactImportDiffPasswords, validateImportRecords, applyValueNormalizeRules, findNewLiveAccountNameDuplicates, type EntitlementContext, type ImportDiff, type ValidationError } from '../services/accountAuthDiff'
import { parseAccountAuthExcelWithMarks } from '../services/parseAccountAuthExcel'
import { listImportValueNormalizeRules } from '../repositories/importValueNormalizeRules'

interface ImportErrorResponse {
  error: string
  errors?: ValidationError[]
}

// 権限・DIAG用アカウントの現状（差分計算の入力）。DIAG用は0件でも正常（廃止予定）
async function loadEntitlementContext(marks: EntitlementContext['marks']): Promise<EntitlementContext> {
  const [currentDiag, currentAuthorities] = await Promise.all([
    listAllAccountAuth('diag'),
    listManagedAuthorities(),
  ])
  return { marks, currentDiag, currentAuthorities }
}

const missingColumnsMessage = (cols: string[]) =>
  `Excelに必要な列がありません: ${cols.join('、')}（電子マニュアル・多機能版HTML・DIAGの3列が必要です）`

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
  @Response<ImportErrorResponse>(400, 'Excelに必要な列がない')
  @Response<ImportErrorResponse>(503, '既存データの取得に失敗（差分計算が信用できないため中断）')
  public async preview(@UploadedFile() file: Express.Multer.File): Promise<ImportDiff | ImportErrorResponse> {
    const parsed = await parseAccountAuthExcelWithMarks(file.buffer)
    if (parsed.missingColumns.length > 0) {
      this.setStatus(400)
      return { error: missingColumnsMessage(parsed.missingColumns) }
    }
    const normalizeRules = await listImportValueNormalizeRules()
    const records = applyValueNormalizeRules(parsed.records, normalizeRules)
    const current = await listAllAccountAuth() // delfg=1含む全件（リストア判定のため）
    let ctx: EntitlementContext
    try {
      assertAccountAuthListLooksValid(current)
      ctx = await loadEntitlementContext(parsed.marks)
    } catch (e: unknown) {
      this.setStatus(503)
      return { error: e instanceof Error ? e.message : '既存データの取得に失敗しました' }
    }
    const diff = computeImportDiff(records, current, ctx)
    diff.validationErrors = validateImportRecords(records, undefined, undefined, current)
    return redactImportDiffPasswords(diff)
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
  @Response<ImportErrorResponse>(503, '既存データの取得に失敗（差分計算が信用できないため中断）')
  public async apply(
    @UploadedFile() file: Express.Multer.File,
    @FormField() commentOverrides?: string,
    @FormField() applyLines?: string
  ): Promise<ApplyImportResult | ImportErrorResponse> {
    const parsed = await parseAccountAuthExcelWithMarks(file.buffer)
    if (parsed.missingColumns.length > 0) {
      this.setStatus(400)
      return { error: missingColumnsMessage(parsed.missingColumns) }
    }
    const normalizeRules = await listImportValueNormalizeRules()
    const records = applyValueNormalizeRules(parsed.records, normalizeRules)
    const current = await listAllAccountAuth()
    let ctx: EntitlementContext
    try {
      assertAccountAuthListLooksValid(current)
      ctx = await loadEntitlementContext(parsed.marks)
    } catch (e: unknown) {
      this.setStatus(503)
      return { error: e instanceof Error ? e.message : '既存データの取得に失敗しました' }
    }
    const errors = validateImportRecords(records, undefined, undefined, current)
    if (errors.length > 0) {
      this.setStatus(400)
      return { error: '検証エラーがあります', errors }
    }
    // rowErrors（3列の値の不正など）の行は、差分に含まれない＝一切更新されない
    const diff = computeImportDiff(records, current, ctx)

    // 差分プレビュー画面で選択された行だけに絞り込む。未指定時は後方互換で全件適用
    if (applyLines !== undefined) {
      const allow = new Set<number>(JSON.parse(applyLines))
      diff.added = diff.added.filter((a) => allow.has(a.line))
      diff.changed = diff.changed.filter((c) => allow.has(c.line))
      diff.deleted = diff.deleted.filter((d) => allow.has(d.line))
      diff.restored = diff.restored.filter((r) => allow.has(r.line))
      diff.entitlementChanges = diff.entitlementChanges.filter((e) => allow.has(e.line))
    }

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

    // 権限とDIAG用アカウントの変化。行（line）単位で、通常アカウントの変更と一緒に適用される
    const entitlementByLine = new Map(diff.entitlementChanges.map((e) => [e.line, e]))
    const applyParams = {
      added: diff.added.map((a) => a.record),
      changed: diff.changed.map((c) => ({ id: c.before.id, after: c.after })),
      deleted: diff.deleted.map((d) => ({ id: d.before.id, comment: d.after.comment ?? '' })),
      restored: diff.restored.map((r) => ({ id: r.before.id, comment: r.after.comment ?? '' })),
      entitlement: {
        addedAuthorities: diff.added.map((a) => entitlementByLine.get(a.line)?.authority?.after ?? null),
        authorityById: diff.entitlementChanges.flatMap((e) =>
          e.accountId !== null && e.authority ? [{ id: e.accountId, authority: e.authority.after }] : [],
        ),
        diag: diff.entitlementChanges.flatMap((e) =>
          e.diag ? [{ id: e.diag.id, delfg: e.diag.after === 'deleted' }] : [],
        ),
      },
    }

    // 最終ガード：選択されたチェックボックスの組み合わせを実際に適用した結果、
    // 生きているaccountNameが新たに重複しないかを確認する。validateImportRecords
    // はファイル全体に対する事前チェックなので、applyLinesで一部だけ選んだ場合の
    // 「この組み合わせで適用すると重複が生まれる」までは検知できないため、
    // 書き込み直前にこの結果ベースのチェックで最後に弾く
    const duplicateNames = findNewLiveAccountNameDuplicates(current, applyParams)
    if (duplicateNames.length > 0) {
      this.setStatus(400)
      return {
        error: `この内容を適用すると、同じaccountNameが複数の有効なアカウントで重複します: ${duplicateNames.join(', ')}`,
      }
    }

    return await applyAccountAuthImport(applyParams)
  }
}
