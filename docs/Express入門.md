# Express入門（知らない人向け）

「Express」という単語だけ聞いても何のことか分からない、という前提で書く。
このプロジェクトの`server/src/index.ts`を教材にして、実物のコードで説明する。
（作成: 2026-07-22）

---

## 1. そもそもExpressって何？

Expressは、Node.js（JavaScriptをサーバー側で動かす仕組み）の上で動く、**Webサーバーを作るための道具（ライブラリ）**。

もう少し噛み砕くと：

- ブラウザ（あるいは他のプログラム）から「このURLにアクセスしたい」というリクエストが飛んでくる
- そのリクエストを受け取って、「何をどう返すか」を決めて、答え（レスポンス）を返す

この「受け取って→答える」窓口の役割をするプログラムを、自分でゼロから書くのは大変（通信の低レベルな処理を全部自前でやることになる）。Expressはその面倒な部分を肩代わりしてくれて、「このURLに来たらこの処理をする」というルールだけを書けばよくしてくれる道具。

このプロジェクトでは、Expressは「運用PC上で常に起動しっぱなしの中継役」として使われている（`CLAUDE.md`のアーキテクチャ図でいう「Express (Node.js): 運用PCで常駐」の部分）。ブラウザ（React画面）と、顧客のPHPサーバーの間に立って、ファイルのやり取りを仲介している。

---

## 2. 「リクエスト」と「レスポンス」

Web通信は基本的にすべて、この1往復で成り立っている。

```
ブラウザ（またはツール）              Expressサーバー
        │                                    │
        │ ①リクエストを送る                  │
        │  「GET /api/katashiki をください」  │
        │ ─────────────────────────────────▶ │
        │                                    │ ②受け取って処理する
        │                                    │
        │ ◀───────────────────────────────── │
        │  ③レスポンスが返ってくる            │
        │  「はい、これがデータです」（JSON）  │
```

- **リクエスト**には「どのURLに」「どういう方法（GET/POST/PUT/DELETEなど）で」「どんなデータを添えて」来たか、という情報が入っている
- **レスポンス**には「成功したか失敗したか（ステータスコード）」と「実際のデータ」が入っている

「GET」「POST」などは**HTTPメソッド**と呼ばれ、大まかに「何をしたいか」を表す：

| メソッド | 意味 | このプロジェクトでの例 |
|---|---|---|
| GET | 取得する（見るだけ、何も変更しない） | 一覧を取得する |
| POST | 新しく作る | レコードを追加する |
| PUT | 丸ごと更新する | レコードを編集する |
| DELETE | 削除する | （このプロジェクトでは未使用。論理削除で代用） |

---

## 3. Expressの基本形：`app.use`とルーティング

`server/src/index.ts`の中身を、上から順に人間の言葉に置き換えてみる。

```ts
const app = express()
```

「これから作るWebサーバーの本体」を用意する、という一行。以降、この`app`に対してルールを追加していく。

```ts
app.use('/api/katashiki', katashikiRouter)
```

これは「`/api/katashiki`で始まるURLに来たリクエストは、`katashikiRouter`という担当者に丸ごと渡す」という意味。`app.use`は「このURLパターンに来たら、この処理担当に振る」という**振り分けルール**を登録する命令。

実際の担当者（`katashikiRouter`）の中身は`server/src/routes/katashiki.ts`にある：

```ts
const router = Router()

router.get('/', (_req, res) => {
  // ここに「型式一覧を返す」処理
  return res.json(katashikiList)
})

router.get('/:id/files', (req, res) => {
  // ここに「特定の型式のファイル一覧を返す」処理
  return res.json(files)
})
```

- `router.get('/', ...)` は「GETメソッドで、ちょうど`/api/katashiki`（何も付け足さない）に来たら、この関数を実行する」という意味
- `router.get('/:id/files', ...)` の`:id`は**プレースホルダー**（穴埋め欄）。実際には`/api/katashiki/ABC-2021/files`のようなURLが来て、`:id`の部分に入った`ABC-2021`が`req.params.id`として関数の中で使える

つまり「**URLのパターンと、それが来た時にすべき処理**」をひたすら列挙していくのがExpressの基本の書き方。

---

## 4. `req`と`res`って何？

上のコードに出てきた`(req, res) => { ... }`という関数。これがリクエストを実際に処理する部分。

- `req`（request） = 届いたリクエストの中身が全部入っている箱。「どんなURLで来たか」「どんなパラメータが付いていたか」「送られてきたデータ」などをここから取り出す
- `res`（response） = 返事を組み立てるための道具。`res.json(...)`で「これをJSON形式で返してね」、`res.status(404)`で「ステータスコード404（見つからない）として返してね」のように使う

`katashiki.ts`の実例：

```ts
router.get('/:id/files', (req, res) => {
  const katashikiDir = path.resolve(config.sambaPath, req.params.id) // ← reqからid取り出し
  if (!fs.existsSync(katashikiDir)) {
    return res.status(404).json({ error: '型式フォルダが見つかりません' }) // ← resで404を返す
  }
  // ...
  return res.json(files) // ← resでデータを返す
})
```

---

## 5. ミドルウェアとは（`app.use`のもう一つの使い方）

`app.use`は振り分けルールだけでなく、「**全部のリクエストに共通して挟みたい処理**」を登録するのにも使われる。これを**ミドルウェア**と呼ぶ。「間に挟むもの」という意味そのまま。

`index.ts`の実例：

```ts
app.use(cors({ origin: 'http://localhost:3000' }))
app.use(express.json({ limit: '50mb' }))
```

- `cors(...)`：ブラウザからのアクセスを許可する設定（[前の説明](データフロー.md)参照）。全リクエストに対して「このオリジンからは許可しますよ」という印を付ける係
- `express.json({ limit: '50mb' })`：送られてきたリクエストの中身がJSON形式なら、それを自動でJavaScriptのオブジェクトに変換して`req.body`に入れておいてくれる係。これが無いと、届いたデータはただの文字の羅列のままで、自分でパースしないといけない

これらは**リクエストが実際の処理（ルート）に届く前に、必ず先に通る関門**として動く。「全員がまずここを通ってからそれぞれの窓口に行く」というイメージ。

エラーハンドラーも同じ仕組みを使っている（`index.ts`末尾）：

```ts
app.use((err: unknown, _req: Request, res: Response, next: NextFunction): void => {
  if (err instanceof ValidateError) {
    res.status(422).json({ message: '入力値が不正です', details: err.fields })
    return
  }
  // ...
})
```

これは「引数が4つある特別な形」で、Expressに「これはエラー処理専用の関門ですよ」と伝わる。どこかの処理でエラーが投げられると、通常のルートをすっ飛ばしてここに流れてくる。

---

## 6. このプロジェクト特有の話：手書きルートとtsoa生成ルートが混在している

`index.ts`をよく見ると、ルートの登録方法が2種類ある：

```ts
// ── 手書きルート（順次tsoaへ移行予定）──
app.use('/api/katashiki', katashikiRouter)
app.use('/api/upload', uploadRouter)
app.use('/api/jobs', jobsRouter)
app.use('/api/master', masterRouter)

// ── tsoa生成ルート（account-auth 他）──
RegisterRoutes(app, { multer: multer({ limits: { fileSize: 50 * 1024 * 1024 } }) })
```

- **手書きルート**：上で説明した`Router()`を自分で書くやり方。`katashiki.ts`のように、URLと処理を自分の手で列挙する
- **tsoa生成ルート**：`account-auth`などで使われている。`accountAuthController.ts`にTypeScriptのクラスと型（`@Get()`, `@Post()`などの飾り＝デコレーター）だけを書くと、tsoaというツールが「対応するExpressのルート登録コード」を自動生成してくれる。`RegisterRoutes(app, ...)`が、その自動生成されたルートを全部まとめて`app`に登録している一行

なぜ2種類あるかというと、`account-auth`のような比較的新しく作った機能はtsoa方式に統一し、古くからある`katashiki`等は「順次tsoaへ移行予定」（コード内コメントより）というだけで、まだ手書きのまま残っている、という過渡期の状態。将来的には全部tsoa方式に揃える方針。

tsoaを使うと、Expressのルート定義に加えて「入力値が型に合っているかの検証」と「API仕様書（Swagger）」も型から自動で作られる。だから`account-auth`のコントローラには`app.use(express.json())`相当の手書きバリデーションが存在しない。

---

## 7. `app.listen`：実際にサーバーを起動する

```ts
app.listen(config.port, () => {
  console.log(`Express server running on http://localhost:${config.port}`)
})
```

ここまでは「こういうルールで動くWebサーバーを作る」という設計図を組み立てていただけで、この`app.listen(...)`が呼ばれて初めて、実際に指定したポート番号（`config.port` = 3001）で「リクエストを待ち受ける」状態になる。ここで初めて他のプログラム（ブラウザやVite）から接続できるようになる。

---

## 8. 1本のリクエストを実際に追ってみる（`GET /api/katashiki`）

1. ブラウザが `http://localhost:3001/api/katashiki` へGETリクエストを送る（実際は3000番からViteプロキシ経由）
2. Expressがリクエストを受け取る。まず`cors`ミドルウェア、次に`express.json`ミドルウェアを通る（今回はJSONの送信データが無いので実質何もしない）
3. `app.use('/api/katashiki', katashikiRouter)`にマッチするので、担当が`katashikiRouter`に決まる
4. `katashikiRouter`の中で、URLが`/`（つまり`/api/katashiki`の続きが空）でGETメソッドなので、`router.get('/', ...)`の関数が実行される
5. その関数がフォルダを読み取り、`res.json(katashikiList)`で結果を返す
6. Expressがそれをブラウザへ返信する

---

## まとめ：覚えておくべき3つ

1. **Expressは「URLパターンごとに処理を振り分ける」道具。** `app.use`や`router.get`で「このURLに来たらこの関数」を登録していく。
2. **ミドルウェアは全リクエスト共通の関門。** CORS許可やJSON変換など、個別のルートより先に必ず通る。
3. **このプロジェクトでは手書きルートとtsoa生成ルートが混在中。** 新しい機能はtsoa方式（型からルート・検証・仕様書を自動生成）に統一していく方針。

関連: [データフロー](データフロー.md)（ExpressがどこからどこへリクエストをつなぐかのAPI全体像） / [技術スタック](技術スタック.md)（なぜExpress + tsoaを選んだか）
