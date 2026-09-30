import { Body, Controller, Delete, Get, Path, Post, Route, SuccessResponse, Response, Tags } from 'tsoa'
import {
  listImportIgnoreNumbers,
  addImportIgnoreNumber,
  removeImportIgnoreNumber,
  type ImportIgnoreNumber,
} from '../repositories/importIgnoreList'

interface AddImportIgnoreNumberBody {
  number: number
  comment?: string
}

interface ImportIgnoreNumberErrorResponse {
  error: string
}

// ┌─────────────────────────────────────────────────────────────┐
// │ Excel取り込みの差分プレビューで「デフォルトで適用しない」     │
// │ アカウントNoを管理するCRUD。詳細はdocs/AMFPHP連携_差分無視    │
// │ リスト.md参照                                                 │
// └─────────────────────────────────────────────────────────────┘
@Route('account-auth/import/ignore-numbers')
@Tags('アカウント認証')
export class ImportIgnoreNumbersController extends Controller {
  /** 一覧取得（del_fg=1の行は除く。repositories/importIgnoreList.tsで絞り込み済み）。
   *  メソッド名はlistにしない：tsoaはメソッド名からoperationIdを生成するため、
   *  AccountAuthController.list()と衝突し生成される型定義が壊れる */
  @Get()
  public async listIgnoreNumbers(): Promise<ImportIgnoreNumber[]> {
    return listImportIgnoreNumbers()
  }

  /** 追加 */
  @Post()
  @SuccessResponse(201, 'Created')
  @Response<ImportIgnoreNumberErrorResponse>(400, '検証エラー')
  public async add(@Body() body: AddImportIgnoreNumberBody): Promise<void | ImportIgnoreNumberErrorResponse> {
    if (!Number.isInteger(body.number)) {
      this.setStatus(400)
      return { error: 'numberは整数で指定してください' }
    }
    await addImportIgnoreNumber(body.number, body.comment ?? null)
    this.setStatus(201)
  }

  /** 削除（論理削除。del_fg=1にする。物理削除ではない） */
  @Delete('{id}')
  public async remove(@Path() id: number): Promise<void> {
    await removeImportIgnoreNumber(id)
  }
}
