import { Body, Controller, Delete, Get, Path, Post, Put, Route, SuccessResponse, Response, Tags } from 'tsoa'
import {
  listAccountAuth,
  createAccountAuth,
  updateAccountAuth,
  deleteAccountAuth,
  type AccountAuth,
  type AccountAuthInput,
} from '../repositories/accountAuth'

// 追加リクエストのボディ（手入力1件もExcel複数件も同じ口）
interface CreateAccountAuthBody {
  records: AccountAuthInput[]
}

interface ErrorResponse {
  error: string
}

// ┌─────────────────────────────────────────────────────────────┐
// │ レイヤ: コントローラ（tsoa）                                  │
// │ 役割: 型からルート結線・リクエスト検証・OpenAPI仕様を自動生成。 │
// │  - @Body の型に沿わないリクエストは tsoa が自動で400を返す     │
// │    （account_id/auth_key の必須チェックは手書き不要）          │
// │  - DBアクセスはリポジトリに委譲（この層はHTTPの作法のみ）      │
// └─────────────────────────────────────────────────────────────┘
@Route('account-auth')
@Tags('アカウント認証')
export class AccountAuthController extends Controller {
  /** 一覧取得 */
  @Get()
  public async list(): Promise<AccountAuth[]> {
    return listAccountAuth()
  }

  /** 追加（1件もExcel複数件も同じ口） */
  @Post()
  @SuccessResponse(201, 'Created')
  @Response<ErrorResponse>(409, 'UNIQUE制約違反など')
  public async create(@Body() body: CreateAccountAuthBody): Promise<{ inserted: number } | ErrorResponse> {
    try {
      const result = createAccountAuth(body.records)
      this.setStatus(201)
      return result
    } catch (e: unknown) {
      this.setStatus(409)
      return { error: e instanceof Error ? e.message : '追加に失敗しました' }
    }
  }

  /** 更新 */
  @Put('{id}')
  @Response<ErrorResponse>(404, '対象が見つかりません')
  public async update(@Path() id: number, @Body() input: AccountAuthInput): Promise<AccountAuth | ErrorResponse> {
    try {
      const updated = updateAccountAuth(id, input)
      if (!updated) {
        this.setStatus(404)
        return { error: '対象が見つかりません' }
      }
      return updated
    } catch (e: unknown) {
      this.setStatus(409)
      return { error: e instanceof Error ? e.message : '更新に失敗しました' }
    }
  }

  /** 削除 */
  @Delete('{id}')
  @Response<ErrorResponse>(404, '対象が見つかりません')
  public async remove(@Path() id: number): Promise<{ deleted: number } | ErrorResponse> {
    const result = deleteAccountAuth(id)
    if (result.deleted === 0) {
      this.setStatus(404)
      return { error: '対象が見つかりません' }
    }
    return result
  }
}
