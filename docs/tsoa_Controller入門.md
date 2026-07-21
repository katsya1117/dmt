# tsoa / コントローラ入門（知らない人向け）

「tsoa」も「コントローラ」も聞いたことが無い、という前提で書く。
`server/src/controllers/accountAuthController.ts`を教材にして、実物のコードで説明する。
[Express入門](Express入門.md)を先に読んでいる前提（「ルーティング」「ミドルウェア」という言葉はそちらで説明済み）。
（作成: 2026-07-22）

---

## 1. まず「コントローラ」って何？

[Express入門](Express入門.md)で説明した通り、Expressの基本は「このURLに来たらこの処理」を`router.get(...)`のように**自分の手で列挙していく**やり方だった。

「コントローラ」は、その「このURLに来たらこの処理」の**まとまり**に付けられた呼び名。「アカウント認証に関する処理は全部この1つのクラスにまとめる」というときの、その入れ物がコントローラ。`AccountAuthController`というクラスの中に、`list`（一覧取得）・`create`（追加）・`update`（更新）という3つの処理がまとまって入っている。

これ自体はExpressの世界だけの話ではなく、Web開発全般でよく使われる整理の仕方。「受付窓口（コントローラ）ごとに、扱う業務をまとめる」というイメージ。

---

## 2. tsoaは何のためにあるのか

`account-auth`のコントローラを開くと、`router.get('/', ...)`のような書き方が一切無い。代わりにこう書いてある：

```ts
@Route('account-auth')
@Tags('アカウント認証')
export class AccountAuthController extends Controller {
  @Get()
  public async list(): Promise<AccountAuth[]> {
    return listAllAccountAuth()
  }
}
```

`@Route`や`@Get`という見慣れない書き方（**デコレーター**と呼ばれるTypeScriptの機能。クラスやメソッドに「印」を付ける飾りだと思えばよい）だけがあって、`app.use`も`router.get`も出てこない。これがtsoaを使ったコントローラの書き方。

tsoaは、こうして「型と飾り（デコレーター）だけ」で書いたコントローラを読み取り、次の3つを**自動生成**してくれるツール：

1. **Expressのルート登録コード**（`router.get('/api/account-auth', ...)`に相当するもの）
2. **リクエストの検証コード**（送られてきたデータが、指定した型と合っているかのチェック）
3. **API仕様書**（Swagger/OpenAPIという、世界共通の「このAPIはこういう入出力です」というドキュメント形式）

つまり、**手書きルートで自分がやっていた「URLの登録」と「入力チェック」の両方を、型を書くだけで肩代わりしてもらう**、というのがtsoaの狙い。

---

## 3. なぜ自動生成が要るのか（手書きとの比較）

手書きルート（`katashiki.ts`）ではこうなる：

```ts
router.get('/:id/files', (req, res) => {
  const id = req.params.id // 型が付いていない。何が来るか実行するまで分からない
  // ...
})
```

`req.params.id`は、TypeScriptから見ると「何が入っているか分からない値」として扱われる。もし呼び出し側が数値のつもりで文字列を送ってきても、コードは何も教えてくれない。「入力値のチェック」をしたければ、自分で`if`文を書くしかない。

tsoa方式（`accountAuthController.ts`）ではこうなる：

```ts
@Put('{id}')
public async update(@Path() id: number, @Body() input: AccountAuthInput): Promise<AccountAuth | ErrorResponse> {
  // ここに来た時点で、idは必ずnumber。inputは必ずAccountAuthInputの形に沿っている
}
```

`@Path() id: number`と書いておくと、tsoaが「URLの`{id}`の部分を取り出して、数値として解釈できなければ自動で400エラーを返す」というコードを生成してくれる。`@Body() input: AccountAuthInput`も同様で、送られてきたデータが`AccountAuthInput`という型（`username`は必須、`delfg`は真偽値、など）に合っているかを自動でチェックしてくれる。**自分で書いたのは型だけ**で、チェック処理そのものは書いていない。

`accountAuthController.ts`の冒頭のコメントにも同じことが書いてある：

```ts
// - @Body の型に沿わないリクエストは tsoa が自動で400を返す
//   （account_id/auth_key の必須チェックは手書き不要）
```

---

## 4. デコレーターの読み方（`@なんとか`は何をしているか）

実際に出てくるデコレーターを、1つずつ人間の言葉にする。

| デコレーター | 付ける場所 | 意味 |
|---|---|---|
| `@Route('account-auth')` | クラス全体 | このコントローラが担当するURLの土台は`/api/account-auth`（`tsoa.json`の`basePath: '/api'`と合わさる） |
| `@Get()` / `@Post()` / `@Put()` | メソッド | このメソッドが、どのHTTPメソッドを受け持つか（[Express入門](Express入門.md)のGET/POST/PUTと同じ意味） |
| `@Path() id: number` | 引数 | URLの`{id}`部分を、この引数に数値として渡す |
| `@Body() input: AccountAuthInput` | 引数 | リクエストのボディ（送られてきたJSONデータ）を、この型として渡す |
| `@Query() includeDeleted?: boolean` | 引数 | URLの`?includeDeleted=true`のようなクエリパラメータを渡す（現在のaccount-authでは未使用。過去に使っていた名残がドキュメントに残っているので注意） |
| `@SuccessResponse(201, 'Created')` | メソッド | 成功した時のステータスコードをAPI仕様書に書き残す（挙動は変えない、ドキュメント用） |
| `@Response<ErrorResponse>(409, '...')` | メソッド | このメソッドが返しうるエラーの形をAPI仕様書に書き残す（同上、ドキュメント用） |
| `@Tags('アカウント認証')` | クラス | Swagger UI上での分類名（見た目の整理用） |

具体例で当てはめると：

```ts
@Put('{id}')
@Response<ErrorResponse>(404, '対象が見つかりません')
public async update(@Path() id: number, @Body() input: AccountAuthInput): Promise<AccountAuth | ErrorResponse> {
```

「`PUT /api/account-auth/{id}`というリクエストを受け付ける。`{id}`はURLから数値として受け取り、リクエストのボディは`AccountAuthInput`型として受け取る。もし404を返すこともある、という情報も仕様書に残しておく」という宣言。

---

## 5. 実際のURLとメソッドの対応（account-auth）

| デコレーター | 実際のURL・メソッド | やること |
|---|---|---|
| `@Get()`（`list`） | `GET /api/account-auth` | 一覧取得 |
| `@Post()`（`create`） | `POST /api/account-auth` | 追加（1件もExcel複数件も同じ口） |
| `@Put('{id}')`（`update`） | `PUT /api/account-auth/{id}` | 更新（論理削除の切り替えもこれで行う） |

メソッド名にURLは含まれず、`@Route`と`@Get`/`@Post`/`@Put`の組み合わせだけでURLが決まる。「メソッド名は自由に付けてよい、URLを決めるのはデコレーターの方」という点は手書きルートと発想が逆（手書きは`router.get('/xxx', ...)`とURL文字列を直接書く）。

---

## 6. 中身で書いていること・書いていないこと

コントローラの中身をもう一度見る：

```ts
public async create(@Body() body: CreateAccountAuthBody): Promise<{ inserted: number } | ErrorResponse> {
  try {
    const result = createAccountAuth(body.records) // ← リポジトリに丸投げ
    this.setStatus(201)
    return result
  } catch (e: unknown) {
    this.setStatus(409)
    return { error: e instanceof Error ? e.message : '追加に失敗しました' }
  }
}
```

コントローラがやっているのは実質これだけ：

1. リクエストを受け取る（型変換・検証はtsoaが済ませてくれている）
2. 実際のデータベース操作は`repositories/accountAuth.ts`（リポジトリ）に丸投げする
3. 結果に応じてステータスコード（`this.setStatus(...)`）を決めて返す

**データベースを直接触るコードはコントローラには一切無い。** これはこのプロジェクトの決まりごとで、「HTTPの作法（受付・検証・ステータスコード）はコントローラ」「データの読み書きはリポジトリ」ときっちり役割分担している（コード冒頭のコメント「DBアクセスはリポジトリに委譲（この層はHTTPの作法のみ）」の通り）。詳しくは[データフロー](データフロー.md)のリポジトリの説明を参照。

---

## 7. ファイルアップロードの例（`accountAuthImportController.ts`）

Excel取り込み機能では、もう1つのデコレーターが出てくる：

```ts
@Post('preview')
public async preview(@UploadedFile() file: Express.Multer.File): Promise<ImportDiff> {
  const records = await parseAccountAuthExcelBuffer(file.buffer)
  // ...
}
```

`@UploadedFile()`は「マルチパート形式（ファイル添付）で送られてきたファイルを、この引数に渡す」という意味。`index.ts`側で`RegisterRoutes(app, { multer: multer({ limits: { fileSize: 50 * 1024 * 1024 } }) })`のように、ファイルサイズの上限などを別途渡している（[Express入門](Express入門.md)§6参照）。

---

## 8. 自動生成は「いつ」起きるのか

ここまでの話は「型と飾りを書けば、あとは自動でやってくれる」だったが、それはコードを書いた**その瞬間**に起きるわけではない。`npm run tsoa`（中身は`tsoa spec-and-routes`というコマンド）を実行したタイミングで、まとめて生成される。

```
server/src/controllers/*.ts（自分が書いたコントローラ）
        │
        │  npm run tsoa
        ▼
server/src/generated/routes.ts    ← Expressのルート登録コード（自動生成）
server/src/generated/swagger.json ← API仕様書（自動生成）
```

生成された`routes.ts`は`index.ts`でこう使われる：

```ts
import { RegisterRoutes } from './generated/routes'
// ...
RegisterRoutes(app, { multer: multer({ limits: { fileSize: 50 * 1024 * 1024 } }) })
```

この1行が、生成された「`account-auth`関連の全ルート登録」を、まとめて`app`に登録している。手書きルートでいう`app.use('/api/katashiki', katashikiRouter)`を、コントローラの数だけ自動でやってくれているようなもの。

**注意点**：`server/src/generated/`は`.gitignore`対象で、Gitには含まれていない。つまり`npm run tsoa`を1度も実行していない環境では、この`import`が解決できずサーバーが起動しない。`npm run dev`は`tsoa`実行込みなのでこれで動く（`"dev": "npm run tsoa && tsx watch src/index.ts"`）。

---

## 9. クライアント側の型もここから生まれる

tsoaが生成した`swagger.json`（API仕様書）は、もう1段階、別の場所でも使われている。`yarn gen:api`（`gen:types`）を実行すると、この仕様書からクライアント側のTypeScript型（`client/src/api/generated/schema.ts`）が自動生成される。

```
コントローラの型（サーバー）
   │ npm run tsoa
   ▼
swagger.json（API仕様書）
   │ openapi-typescript
   ▼
schema.ts（クライアント側の型）
```

つまり、**「サーバーが受け取る/返す形」の一次情報はコントローラの型だけ**で、クライアント側は手で二重に型を定義しない。コントローラの型を変えれば、`npm run gen:api`を実行するだけでクライアント側の型も追従する。

---

## まとめ：覚えておくべき3つ

1. **コントローラ＝業務ごとの窓口のまとまり。** `AccountAuthController`のように、関連する処理をクラス1つにまとめる。
2. **tsoaは「型＋デコレーター」から「ルート登録・入力検証・API仕様書」を自動生成する。** 自分で`app.use`もバリデーションも書かない。
3. **生成は`npm run tsoa`実行時に一度だけ起きる。** コードを保存した瞬間ではない。生成物はGit管理外なので、動かす前に必ず実行が要る（`npm run dev`はこれ込み）。

関連: [Express入門](Express入門.md)（ルーティング・ミドルウェアの基礎） / [データフロー](データフロー.md)（コントローラの前後にある層） / [画面実装パターン](画面実装パターン.md)（コントローラを含む8ファイル構成）
