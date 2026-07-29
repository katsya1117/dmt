// ※ DELETE を開放する時は import に `Delete` を、下記import に `deleteAccountAuth` を戻す
import { Body, Controller, Get, Path, Post, Put, Route, SuccessResponse, Response, Tags } from 'tsoa'
import {
  listAllAccountAuth,
  createAccountAuth,
  updateAccountAuth,
  // deleteAccountAuth, // ← DELETE未開放。開放時に戻す
  type AccountAuth,
  type AccountAuthInput,
} from '../repositories/accountAuth'
import { validateImportRecords } from '../services/accountAuthDiff'

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
  /** 一覧取得。削除済み(delfg=1)も含めた全件（手動リストア用に「状態」列で区別する） */
  @Get()
  public async list(): Promise<AccountAuth[]> {
    return listAllAccountAuth()
  }

  /** 追加（1件もExcel複数件も同じ口）。Excel取り込みと同じ検証関数で
   *  必須項目・No.重複・username重複を弾く。重複は「生きている(delfg=false)
   *  レコード同士」でのみ判定する（削除済みのNo./usernameは再利用可、という
   *  客先の運用要望のため）。
   *  usernameにDB UNIQUE制約は無い（客先の旧運用による重複が実在するため）
   *  ので、重複拒否はこのアプリ層の検証が唯一の砦 */
  @Post()
  @SuccessResponse(201, 'Created')
  @Response<ErrorResponse>(400, '検証エラー')
  @Response<ErrorResponse>(409, '予期しないDBエラー')
  public async create(@Body() body: CreateAccountAuthBody): Promise<{ inserted: number } | ErrorResponse> {
    const alive = listAllAccountAuth().filter((r) => !r.delfg)
    const existingNumbers = new Set(alive.map((r) => r.number).filter((n): n is number => n != null))
    const existingUsernames = new Set(alive.map((r) => r.username))
    const errors = validateImportRecords(body.records, existingNumbers, existingUsernames)
    if (errors.length > 0) {
      this.setStatus(400)
      return { error: errors.join(' / ') }
    }
    try {
      const result = createAccountAuth(body.records)
      this.setStatus(201)
      return result
    } catch (e: unknown) {
      this.setStatus(409)
      return { error: e instanceof Error ? e.message : '追加に失敗しました' }
    }
  }

  /** 更新（リストア＝delfg: true→falseも含む）。更新後にdelfg=falseになる
   *  場合のみ、自分以外の生きているレコードとNo./username重複がないか検証する
   *  （削除済みのままにする更新や、削除する更新は重複を気にしなくてよい）。
   *  passwordは空文字＝「パスワードを変更する」チェックOFF（クライアント側の
   *  規約）で、既存ハッシュを維持する（実際のハッシュ化・維持判定はリポジトリ
   *  層で行う）。ここでは必須チェックが誤爆しないよう、検証にかける値だけ
   *  「維持される既存ハッシュ」に差し替えておく */
  @Put('{id}')
  @Response<ErrorResponse>(400, '検証エラー')
  @Response<ErrorResponse>(404, '対象が見つかりません')
  public async update(@Path() id: number, @Body() input: AccountAuthInput): Promise<AccountAuth | ErrorResponse> {
    const all = listAllAccountAuth()
    const current = all.find((r) => r.id === id)
    if (!current) {
      this.setStatus(404)
      return { error: '対象が見つかりません' }
    }
    if (!input.delfg) {
      const others = all.filter((r) => r.id !== id && !r.delfg)
      const existingNumbers = new Set(others.map((r) => r.number).filter((n): n is number => n != null))
      const existingUsernames = new Set(others.map((r) => r.username))
      const recordForValidation: AccountAuthInput = {
        ...input,
        password: input.password.trim() === '' ? current.password : input.password,
      }
      const errors = validateImportRecords([recordForValidation], existingNumbers, existingUsernames)
      if (errors.length > 0) {
        this.setStatus(400)
        return { error: errors.join(' / ') }
      }
    }
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

  // ─────────────────────────────────────────────────────────────
  // 【DELETE 未開放】客先DBで物理削除が不調のため開放しない。
  // 論理削除は delfg を PUT で更新して行う（AccountAuthInput に delfg あり）。
  // 開放する時：このブロックのコメントを外し、上部importの Delete /
  // deleteAccountAuth を復活させる。
  //
  // /** 削除 */
  // @Delete('{id}')
  // @Response<ErrorResponse>(404, '対象が見つかりません')
  // public async remove(@Path() id: number): Promise<{ deleted: number } | ErrorResponse> {
  //   const result = deleteAccountAuth(id)
  //   if (result.deleted === 0) {
  //     this.setStatus(404)
  //     return { error: '対象が見つかりません' }
  //   }
  //   return result
  // }
  // ─────────────────────────────────────────────────────────────
}
