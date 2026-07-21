# RTK Query入門（知らない人向け）

「RTK Query」という単語だけ聞いても何のことか分からない、という前提で書く。
このプロジェクトの`client/src/store/services/accountAuthApi.ts`を教材にして、実物のコードで説明する。
（作成: 2026-07-22）

---

## 1. そもそも何のためにあるのか

画面が表示するデータは、多くの場合サーバー（Express）から取ってくる。ということは、画面のコードのどこかに必ず「サーバーにお願いして、返事を待って、結果を画面の状態にしまう」という処理が要る。

これを毎回自分の手で書くと、地味に面倒なことがいくつも発生する：

- 「今読み込み中かどうか」を自分でtrue/false管理しないといけない
- 「エラーが起きたかどうか」も自分で管理しないといけない
- 一覧を1回取得した後、別の画面に行ってまた戻ってきたとき、**もう一度取りに行くべきか、さっき取った結果を使い回していいか**を自分で判断しないといけない
- レコードを1件追加したあと、「一覧の表示も更新しないと画面が古いままになる」ことを、自分で「一覧を再取得するコード」を書いて対応しないといけない

RTK Queryは、この「サーバーから来たデータを画面用に管理する」お世話係をまるごと引き受けてくれるライブラリ。「読み込み中」「エラー」「取得済みデータの使い回し（キャッシュ）」「更新後の自動再取得」を、全部裏側でやってくれる。

似た機能を持つライブラリに「TanStack Query」もあり、このプロジェクトでは以前使っていたが、[状態管理の設計判断](状態管理の設計判断.md)に書かれている理由でRTK Queryに統一した経緯がある。

---

## 2. 前提：「サーバー状態」と「画面だけの状態」は別物

RTK Queryを理解する前に、区別しておきたい考え方がひとつある。

- **画面だけの状態**：「ダイアログが開いているか」「検索欄に何を入力したか」など、そのタブを閉じれば消えてよい情報
- **サーバー状態**：データベースに保存されている「本当のデータ」を、画面用に一時的にコピーしてきたもの。他の人が変更するかもしれないし、時間が経つと古くなるかもしれない

`AccountAuthTable.tsx`の中でも、この2つは明確に別の書き方で管理されている：

```ts
// サーバー状態（RTK Queryが管理）
const { data, isLoading, error } = accountAuthApi.useAccountAuthListQuery()

// 画面だけの状態（Reactの素のuseStateで管理）
const [dialogOpen, setDialogOpen] = useState(false)
const [numberSearch, setNumberSearch] = useState('')
```

「ダイアログが開いているか」はサーバーに保存する必要が無いのでただの`useState`。一方「アカウント一覧」はデータベースの中身のコピーなので、RTK Queryに任せる。

---

## 3. 核となる考え方：`query`（読む）と`mutation`（書く・変える）

RTK Queryでは、サーバーとのやり取りをこの2種類に分けて考える：

| 種類 | 意味 | このプロジェクトでの例 |
|---|---|---|
| **query** | データを読み取るだけ。何も変更しない | 一覧取得 |
| **mutation** | データを追加・変更・削除する | 新規追加、更新、Excel取り込みの反映 |

なぜ分けるかというと、mutation（何かを変更する処理）が成功した後は、「表示中のデータが古くなった可能性がある」ので、対応するqueryを**自動的に再取得させる**仕組みがある。それを実現するために、あらかじめ「これはquery」「これはmutation」と申告しておく必要がある。

---

## 4. 実物を読む：`accountAuthApi.ts`

```ts
export const accountAuthApi = createApi({
  reducerPath: 'accountAuthApi',
  baseQuery: fakeBaseQuery<ApiError>(),
  tagTypes: ['AccountAuth'],
  endpoints: (builder) => ({
    accountAuthList: builder.query<AccountAuth[], void>({
      queryFn: async () => {
        try {
          return { data: await fetchAccountAuthList() }
        } catch (err) {
          return { error: err as ApiError }
        }
      },
      providesTags: ['AccountAuth'],
    }),

    createAccountAuth: builder.mutation<{ inserted: number }, AccountAuthInput[]>({
      queryFn: async (records) => {
        try {
          return { data: await createAccountAuth(records) }
        } catch (err) {
          return { error: err as ApiError }
        }
      },
      invalidatesTags: ['AccountAuth'],
    }),
    // ...
  }),
})
```

1行ずつ、人間の言葉に置き換える。

### `createApi({ ... })`

「サーバーとやり取りする窓口を1つ、まとめて作る」という宣言。account-auth用の窓口をこの1ファイルに集約している（他の機能を作るときは、また別の`xxxApi.ts`を作る）。

### `endpoints: (builder) => ({ ... })`

「この窓口で扱える操作の一覧」。`accountAuthList`（一覧取得）、`createAccountAuth`（追加）のように、名前を付けて1つずつ定義していく。この**名前がそのまま自動生成されるフックの名前になる**（後述）。

### `accountAuthList: builder.query<AccountAuth[], void>({ ... })`

「これはqueryです（読み取り専用）」という宣言。`<AccountAuth[], void>`の部分は型で、「戻り値は`AccountAuth`の配列」「引数は無し（`void`）」という意味。

### `queryFn: async () => { ... }`

実際に何をするかの中身。ここでは「api関数（`fetchAccountAuthList`）を呼んで、成功したら`{ data: 結果 }`、失敗したら`{ error: エラー }`という決まった形で返す」という約束になっている。RTK Query側はこの形式の戻り値を見て、成功/失敗を判断する。

### `providesTags: ['AccountAuth']`

「このqueryが提供しているデータには`'AccountAuth'`という札を付けておく」という意味。この札が、次の`invalidatesTags`と連動する。

### `createAccountAuth: builder.mutation<..., ...>({ ... })`

「これはmutationです（何かを変更する）」という宣言。中身の書き方はqueryとほぼ同じだが、最後に`invalidatesTags: ['AccountAuth']`が付いている。

### `invalidatesTags: ['AccountAuth']`

「この処理が成功したら、`'AccountAuth'`という札が付いているqueryは**古くなった**ことにして、自動的に再取得させる」という意味。これのおかげで、新規追加や編集が成功すると、**自分で「一覧を再取得するコード」を1行も書かなくても**、画面の一覧が勝手に最新化される。

---

## 5. 自動生成される「フック」

`createApi`にendpointを定義すると、RTK Queryが**その名前を元にしたフック（Reactで使う関数）を自動的に作ってくれる**。自分でフックを書く必要は無い。

命名ルールはこう：

| endpoint名 | 種類 | 生成されるフック名 |
|---|---|---|
| `accountAuthList` | query | `useAccountAuthListQuery` |
| `createAccountAuth` | mutation | `useCreateAccountAuthMutation` |
| `updateAccountAuth` | mutation | `useUpdateAccountAuthMutation` |

画面側では、これをそのまま呼ぶだけでいい：

```ts
// 読み取り：呼んだ瞬間に自動でリクエストが発生する
const { data, isLoading, error } = accountAuthApi.useAccountAuthListQuery()

// 書き込み：呼んでおいて、実行したいタイミングで関数を呼ぶ
const [create, { isLoading: creating }] = accountAuthApi.useCreateAccountAuthMutation()
// ...
await create([input]).unwrap()
```

- queryのフックは「呼ぶと自動でデータ取得が始まり、`data`（結果）・`isLoading`（読み込み中か）・`error`（失敗したか）を返してくれる」
- mutationのフックは「実行するための関数」と「実行中かどうかの情報」のペアを返す。関数は呼ぶまで何も起きない（ボタンを押した時などに呼ぶ）

このプロジェクトには「画面とRTK Queryの間にもう1枚フックを挟む」パターンは無い（[画面実装パターン](画面実装パターン.md)参照）。自動生成されたフックの名前をそのまま画面から使う、というのがルール。

---

## 6. `.unwrap()`って何？

```ts
await create([input]).unwrap()
```

mutationの関数を呼ぶと、実は「成功でも失敗でも例外を投げずに、`{ data: ... }`か`{ error: ... }`のオブジェクトを返す」という動きをする。しかし画面側のコードでは、ふつうのJavaScriptの`try/catch`で失敗を扱いたい。

`.unwrap()`を付けると、「成功なら中身（`data`）だけを返す・失敗なら例外として投げ直す」という、扱いやすい形に変換してくれる。だから`AccountAuthTable.tsx`では：

```ts
const handleSubmit = async (input: AccountAuthInput) => {
  if (editTarget) {
    await update({ id: editTarget.id, input }).unwrap()
  } else {
    await create([input]).unwrap()
  }
}
```

のように、ふつうの`await`＋`try/catch`スタイルで書ける。

---

## 7. キャッシュとは結局何なのか

「キャッシュ」＝「一度取ってきたデータを覚えておいて、次に同じものが必要になったときは、もう一度サーバーに聞きに行かずに使い回す」仕組み。

具体的な効果：

- 一覧画面 → 別画面 → 一覧画面、と行き来しても、直近取得したデータがあれば一瞬で表示できる（裏側で最新版を取りに行きつつ、まず古いデータを先に見せる、という動きもできる）
- 新規追加・編集が成功すると、`invalidatesTags`の仕組みで「このデータはもう古い」と印が付き、次に表示されるタイミングで自動的に再取得される

このプロジェクトでは`fakeBaseQuery`という設定を使っている（`accountAuthApi.ts`の`baseQuery: fakeBaseQuery<ApiError>()`）。これは「実際の通信部分（axios）は自前の`api/accountAuth.ts`に任せて、RTK Queryにはキャッシュ管理だけをやらせる」という選択。RTK Query標準の通信機能（`fetchBaseQuery`）を使わず、既存のaxios資産をそのまま活かすための設定。

---

## 8. 1つの操作を最初から最後まで追ってみる（新規追加）

1. ユーザーがフォームに入力して「追加」ボタンを押す
2. 画面側が `create([input]).unwrap()` を呼ぶ（`create`は`useCreateAccountAuthMutation()`が返した関数）
3. RTK Query内部で`createAccountAuth`のqueryFnが実行され、`api/accountAuth.ts`の`createAccountAuth()`（axiosでPOST）が呼ばれる
4. サーバーが成功を返す
5. RTK Queryが`invalidatesTags: ['AccountAuth']`を見て、「`'AccountAuth'`の札が付いているquery（＝一覧取得）は古い」と判断
6. 一覧取得(`accountAuthList`)が**自動的に**再実行される
7. 新しいデータが`data`に入り、Reactが再描画。画面の一覧に今追加した行が反映される

3〜6のあいだ、画面側のコードは一切「一覧を再取得して」とは書いていない。これがRTK Queryの一番の効能。

---

## まとめ：覚えておくべき3つ

1. **query＝読む、mutation＝変える。** この区別によって「変更後に何を再取得すべきか」を自動化できる。
2. **`providesTags`と`invalidatesTags`が対になっている。** 同じ札（タグ）が付いているqueryが、mutation成功時に自動再取得される。
3. **フックは自動生成される。** endpoint名を書けば`useXxxQuery`/`useXxxMutation`が使えるようになる。自分でフックを書き足す必要はない（実ロジックが要る時だけ例外的に足す）。

関連: [データフロー](データフロー.md)（画面→RTK Query→API関数→サーバーの全体像） / [状態管理の設計判断](状態管理の設計判断.md)（なぜRTK Queryを選んだか） / [画面実装パターン](画面実装パターン.md)（実装時のファイル構成ルール）
