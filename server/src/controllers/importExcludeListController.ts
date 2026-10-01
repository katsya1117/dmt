import { Body, Controller, Delete, Get, Path, Post, Route, SuccessResponse, Response, Tags } from 'tsoa'
import {
  listImportExcludeNumbers,
  addImportExcludeNumber,
  removeImportExcludeNumber,
  type ImportExcludeNumber,
} from '../repositories/importExcludeList'

interface AddImportExcludeNumberBody {
  number: number
  comment?: string
}

interface ImportExcludeNumberErrorResponse {
  error: string
}

// ┌─────────────────────────────────────────────────────────────┐
// │ Excel取り込みの差分プレビューで「デフォルトで適用しない」     │
// │ アカウントNoを管理するCRUD。詳細はdocs/AMFPHP連携_差分除外    │
// │ リスト.md参照                                                 │
// └─────────────────────────────────────────────────────────────┘
@Route('account-auth/import/exclude-numbers')
@Tags('アカウント認証')
export class ImportExcludeNumbersController extends Controller {
  /** 一覧取得（del_fg=1の行は除く。repositories/importExcludeList.tsで絞り込み済み）。
   *  メソッド名はlistにしない：tsoaはメソッド名からoperationIdを生成するため、
   *  AccountAuthController.list()と衝突し生成される型定義が壊れる */
  @Get()
  public async listExcludeNumbers(): Promise<ImportExcludeNumber[]> {
    return listImportExcludeNumbers()
  }

  /** 追加 */
  @Post()
  @SuccessResponse(201, 'Created')
  @Response<ImportExcludeNumberErrorResponse>(400, '検証エラー')
  public async add(@Body() body: AddImportExcludeNumberBody): Promise<void | ImportExcludeNumberErrorResponse> {
    if (!Number.isInteger(body.number)) {
      this.setStatus(400)
      return { error: 'numberは整数で指定してください' }
    }
    await addImportExcludeNumber(body.number, body.comment ?? null)
    this.setStatus(201)
  }

  /** 削除（論理削除。del_fg=1にする。物理削除ではない） */
  @Delete('{id}')
  public async remove(@Path() id: number): Promise<void> {
    await removeImportExcludeNumber(id)
  }
}
