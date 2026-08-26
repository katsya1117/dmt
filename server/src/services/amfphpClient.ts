import { config } from '../config'

// ─────────────────────────────────────────────────────────────
// AMFPHP（レガシー）のJSONプラグインを叩くための薄いクライアント。
//
// 【この層に閉じ込めているもの】
// - リクエスト形（{serviceName, methodName, parameters}。parametersは
//   docs/legacy-amfphp/webService/DbManagerTInetUserAuth.php が読む
//   $arg[0][0]=userid, [1]=key, [2]=target, [3]=targetTableId, [4]=... という
//   位置引数の並び）
// - レスポンス形（$resultValue の code/errorcode/errormsg/output という
//   エンベロープ。code===0が成功、それ以外は例外化する）
//
// 呼び出し側（リポジトリ）はAccountAuth等アプリのドメイン型だけを扱い、この
// エンベロープ形や位置引数の並びを知らなくてよい。将来AMFPHPを廃止する時は、
// このファイルを新しいHTTPクライアントに差し替えれば、呼び出し側は無改修で済む
// ─────────────────────────────────────────────────────────────

const RESULT_SUCCESS = 0

// AuthSession::connectionDb($select)の引数。0=プライマリDB / 0以外=レプリカDB。
// レプリカを使う積極的な理由が無い（このアプリの規模では負荷分散が不要）上、
// 書き込み直後に同じデータを読み直す実装（updateAccountAuth等）がレプリカの
// 反映遅延で古い値を返すリスクがあるため、環境変数では設定不可にしてプライマリ固定にする
const AMFPHP_TARGET = 0

interface AmfphpEnvelope<T> {
  code: number
  errorcode?: number
  errormsg?: string
  output?: T
}

export class AmfphpError extends Error {
  constructor(
    public readonly serviceName: string,
    public readonly methodName: string,
    public readonly errorcode: number | undefined,
    message: string,
  ) {
    super(`AMFPHP error [${serviceName}.${methodName}] code=${errorcode ?? '?'}: ${message}`)
    this.name = 'AmfphpError'
  }
}

// DbManagerXxx系サービスは全メソッドが $arg[0] = [userid, key, target, ...args] という
// 位置引数を受け取る規約（docs/legacy-amfphp/webService/DbManagerTInetUserAuth.php参照）。
// args にはこの3つに続く残りの引数（例: targetTableId, data）を渡す
export async function callAmfphpService<T>(serviceName: string, methodName: string, args: unknown[]): Promise<T> {
  const parameters = [[config.amfphp.userid, config.amfphp.key, AMFPHP_TARGET, ...args]]

  const res = await fetch(config.amfphp.gatewayUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serviceName, methodName, parameters }),
  })
  if (!res.ok) {
    throw new AmfphpError(serviceName, methodName, undefined, `HTTP ${res.status}`)
  }

  const envelope = (await res.json()) as AmfphpEnvelope<T>
  if (envelope.code !== RESULT_SUCCESS) {
    throw new AmfphpError(serviceName, methodName, envelope.errorcode, envelope.errormsg ?? '(no message)')
  }
  return envelope.output as T
}
