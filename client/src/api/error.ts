// サーバーが返したエラーを、ステータス・ボディ込みで運ぶための型。
// 画面側はこれを見て「フォーム項目の下に赤字」か「全体トースト」かを判断する。
export class ApiError extends Error {
  status: number
  body: unknown
  constructor(status: number, body: unknown, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

// tsoaの422バリデーションエラーのボディ形
// 例: { message, details: { "records.$0.username": { message: "..." } } }
type ValidateBody = { message?: string; details?: Record<string, { message: string }> }

/**
 * サーバーエラーを「フォーム項目ごとのエラー」に変換する。
 * - 422(tsoa検証): details のキー末尾をフィールド名として拾う
 * - 409(UNIQUE): username 重複として username に紐付け
 * 返り値: { field: message } のマップ（フォームに無いフィールドは呼び出し側で無視）
 */
export function toFieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError)) return {}

  if (err.status === 422) {
    const details = (err.body as ValidateBody)?.details ?? {}
    const out: Record<string, string> = {}
    for (const [key, val] of Object.entries(details)) {
      const field = key.split('.').pop() ?? key // "records.$0.username" → "username"
      out[field] = val.message
    }
    return out
  }

  if (err.status === 409) {
    return { username: 'このユーザー名は既に使われています' }
  }

  return {}
}
