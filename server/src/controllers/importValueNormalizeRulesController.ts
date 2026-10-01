import { Body, Controller, Delete, Get, Path, Post, Route, SuccessResponse, Response, Tags } from 'tsoa'
import {
  listImportValueNormalizeRules,
  addImportValueNormalizeRule,
  removeImportValueNormalizeRule,
  type ImportValueNormalizeRule,
} from '../repositories/importValueNormalizeRules'
import { NORMALIZABLE_FIELDS } from '../services/accountAuthDiff'

interface AddImportValueNormalizeRuleBody {
  field: string
  fromValue: string
  toValue: string
}

interface ImportValueNormalizeRuleErrorResponse {
  error: string
}

// ┌─────────────────────────────────────────────────────────────┐
// │ Excel取り込みの比較前値置換ルール（ハッチ機能）のCRUD。         │
// │ 【社内限定機能】将来の権限管理実装時、客先ロールには見せない   │
// │ こと。詳細はdocs/Excel取り込み_比較前値置換ルール.md参照        │
// └─────────────────────────────────────────────────────────────┘
@Route('account-auth/import/normalize-rules')
@Tags('アカウント認証')
export class ImportValueNormalizeRulesController extends Controller {
  /** 一覧取得（del_fg=1の行は除く） */
  @Get()
  public async listNormalizeRules(): Promise<ImportValueNormalizeRule[]> {
    return listImportValueNormalizeRules()
  }

  /** 追加。fieldはNORMALIZABLE_FIELDS（文字列型の列のみ）に含まれないと拒否する */
  @Post()
  @SuccessResponse(201, 'Created')
  @Response<ImportValueNormalizeRuleErrorResponse>(400, '検証エラー')
  public async addNormalizeRule(
    @Body() body: AddImportValueNormalizeRuleBody,
  ): Promise<void | ImportValueNormalizeRuleErrorResponse> {
    if (!NORMALIZABLE_FIELDS.some((f) => f === body.field)) {
      this.setStatus(400)
      return { error: `fieldは次のいずれかで指定してください: ${NORMALIZABLE_FIELDS.join(', ')}` }
    }
    if (body.fromValue === '' || body.toValue === '') {
      this.setStatus(400)
      return { error: 'fromValue/toValueは空にできません' }
    }
    await addImportValueNormalizeRule(body.field, body.fromValue, body.toValue)
    this.setStatus(201)
  }

  /** 削除（論理削除。del_fg=1にする。物理削除ではない） */
  @Delete('{id}')
  public async removeNormalizeRule(@Path() id: number): Promise<void> {
    await removeImportValueNormalizeRule(id)
  }
}
