# アカウント認証：権限とDIAG用アカウント

（作成: 2026-10-28。Excel取り込みで、権限（`t_user_authority_manage`）とDIAG用アカウントを同時に扱う仕様と実装メモ。
判定ルールの実装は `server/src/services/accountAuthEntitlement.ts`、差分計算は `accountAuthDiff.ts`）

## DIAG手動閲覧・編集画面を無効化（2026-11-04）

DIAGアカウントの情報（accountName・パスワード等の中身）は、このアプリはもちろん客先の他システム（旧FLEXアプリ含む）
からも一切参照されないことが分かった（ユーザー確認）。DIAG用テーブルは「DIAG列が○かどうか」を示すフラグとしてのみ
意味があり、行の中身を人が見る必要が無い。そのため`AccountAuthTable.tsx`の通常⇔DIAG切り替えボタン・画面を**コード上で
完全に無効化**した（`target`/`isDiag`を`'normal'`/`false`に固定し、関連コードをコメントアウト。削除はしていない）。

- **Excel取り込み側（判定ロジック・DIAG用テーブルへの論理削除/復活の書き込み）は触っていない**。判定ロジック（本ドキュメントの表）は
  通常登録・権限の計算に必須で、DIAGテーブルを読み書きするかとは無関係。書き込みは既に動いているものを今さら削るリスクが
  実利（誰も読まない）に見合わないため、あえて残した
- DIAG行が通常テーブルにも対応する生きた行を持つか（＝現役か、DIAG専用で死んでいるか）を判定する
  `hasLiveNormalCounterpart`（`AccountAuthTable.tsx`）も、無効化中のDIAG画面用に実装だけ済ませてある
  （`isDiag`が常にfalseなので今は発火しない）。画面を復活させる時はコメントアウトを戻すだけで動き出す
- 復活させる判断基準・手順は本ファイルの変更前の内容（以下）を参照

## 何をするか

管理簿（Excel）の3列 **電子マニュアル／多機能版HTML／DIAG** と解約日から、1アカウントの「あるべき状態」を導き、
DBの現状との差分を取り込みプレビューに出して、承認後に適用する。

| 対象 | 内容 |
|---|---|
| 通常アカウント | `t_inet_user_auth`（アプリ内の名前は account_auth） |
| DIAG用アカウント | 通常と同じ構造の別テーブル。**廃止予定**のため、既存行の論理削除と復活だけを扱い、新規追加は作らない |
| 権限 | `t_user_authority_manage`（どのアカウントにどの権限を付けたか）＋ `t_authority_manage`（権限の種類）。このツールが触るのは `ALL_MANUAL` と `HTML_BROWSING` の2種類だけ |

権限は**三者択一**（なし／`ALL_MANUAL`／`HTML_BROWSING`）で、同時に2つは付かない。権限は通常アカウントにだけ付く。

## 判定ルール（解約日なし）

値は ○（表記ゆれ〇・⚪・◯を含む）／×／入力なし の3つが有効。電子マニュアル列は「入力なし」を ○ と同じ扱いにする。
多機能版HTML列とDIAG列は ○ だけが「有効」で、× と入力なしは同じ（「−」）。

| 電子マニュアル | 多機能版HTML | DIAG | 通常 | DIAG用 | 権限 |
|---|---|---|---|---|---|
| ○/空 | ○ | ○ | 登録 | 生 | `ALL_MANUAL` |
| ○/空 | ○ | − | 登録 | なし | `ALL_MANUAL` |
| ○/空 | − | ○ | 登録 | 生 | なし |
| ○/空 | − | − | 登録 | なし | なし |
| × | ○ | ○ | 登録 | 生 | `HTML_BROWSING` |
| × | ○ | − | 登録 | なし | `HTML_BROWSING` |
| × | − | ○ | 登録しない | 生 | なし |
| × | − | − | （エラー） | | |

- 「生」は DIAG用の行が生きている（`delfg = 0`）。DIAG ○ で行が無くても**新規追加はしない**（何もしない）。
- 解約日あり：通常・DIAG用を論理削除し、権限も外す（`applicate = 0`）。解約日が消えて復活したら、列の値から再計算して戻す。
- 権限を外すときは行を消さず `applicate = 0`（UNIQUE KEY があり、再付与は行の再利用になる）。

## エラー（その行は一切更新しない）

エラーになった行は差分から外れ（通常・DIAG用・権限のどれも更新されない）、他の行の適用は止めない。
検証エラー（`validationErrors`：重複など。1件でもあれば適用全体を拒否）とは別物で、`rowErrors` として返す。

1. 3列のどれかに ○・×・入力なし以外の記号がある（その列は「入力なし」として扱い、あったこと自体をエラーにする）
2. 電子マニュアル ×・多機能版HTMLなし・DIAGなし（どこにも登録されない）
3. 生きている通常アカウントが、解約日なしで「電子マニュアル ×・多機能版HTMLなし」になる変更
   （通常アカウントが論理削除されるのは解約日が入ったときだけ。通常が無い／削除済みのままなら正常＝DIAGのみのユーザー）

Excelに3列のどれかが無い場合は、取り込み自体を 400 で拒否する（フォーマットは客先と固定で握っているため、変わったら気づきたい）。
※DIAG列の実際の見出し表記は客先ファイルで未確認（`parseAccountAuthExcel.ts` の `ENTITLEMENT_HEADERS`）。

## 突き合わせ

通常・DIAG用の対応する行は、既存の取り込みと同じ **No.優先（なければ accountName）** で探す。
3列は account_auth のDB列ではないため、Excelの値を DBの権限行・DIAG用の行から導出した状態と比べる。

## API／PHP

| 層 | 追加・変更 |
|---|---|
| Express | `GET/PUT /api/account-auth?target=normal|diag`（DIAG用への `POST` 追加は 400）。取り込みの preview/apply が権限・DIAG用を扱う |
| PHP | `DbManagerTInetUserAuth` / `DbManagerTInetUserAuthDiag`（load/update。実装は `lib/TInetUserAuthBase.php` 共通）、`DbManagerAuthorityManage`（load/update。権限専用の正規サービス）、`DbManagerAccountAuthImport`（`apply`：Excel取り込み適用**専用**。通常・DIAG用・権限をまたぐ） |

`apply` は通常アカウントを INSERT した直後の `lastInsertId` で権限を書く。`account_type` は通常/DIAGを区別する列ではない
（ユーザー確認）ため、旧PHPが電子マニュアルアカウントの権限行に使っていた `0` を固定で使う。

## 手動編集からの権限変更（2026-11-12追加）

DIAG手動画面を無効化した代わり、**既存のアカウント認証編集フォームから直接権限を変更できる**ようにした
（権限専用の管理画面は作らない方針。経緯は本ドキュメント末尾の設計メモ、および
memory: project-diag-and-authority-rules参照）。手動変更はあくまで一時的なもので、次回のExcel取り込みで
電子マニュアル/多機能版HTML列の内容に応じて上書きされ直す（Excelが正）。

- `AccountAuthFormDialog`に三者択一の「権限」セレクタを追加。編集時は現在値（`AccountAuth.authority`）で
  プリフィル、新規追加時も選択可能
- `PUT /api/account-auth/{id}` のボディを `AccountAuthInput` 単体から `{ input, authority? }` に変更。
  `POST /api/account-auth` には `authorities?: (Authority|null)[]`（`records`と同じ並び）を追加。
  どちらも**省略時（undefined）は権限に一切触れない**（JSON上キー自体が無ければPHP側のproperty_existsで判定）
- `GET /api/account-auth?target=normal` のレスポンスに `authority` を追加（`target=diag`は常に`null`。
  権限は通常アカウントにだけ付くため）

### PHP側の設計判断：なぜ専用サービスを分けたか

当初「権限を書くには`DbManagerAccountAuthImport`を手動編集からも呼べばいい」と考えたが、**それは誤りだった**。
`DbManagerAccountAuthImport`は名前・設計ともにExcel取り込み専用（複数件のバッチ適用、ベストエフォートで
途中失敗は次回の再取り込みで補う前提）であり、手動の単発編集（1件だけ、その場で正確な成否を返したい）とは
呼び出し方・エラー処理の考え方が異なる。別の操作を同じサービスに無理に押し込むのではなく、以下のように
**実際のSQL処理を行うモジュールだけを共有**する構成にした。

```
TInetUserAuthWriter（モジュール。ログイン確認・DB接続を持たない）
  ├─ DbManagerTInetUserAuth / DbManagerTInetUserAuthDiag（通常/DIAG）
  └─ DbManagerAccountAuthImport（Excel取り込み適用から直接呼ぶ）

AuthorityManageWriter（モジュール。同上。lib/AuthorityManageWriter.php、
  旧DbManagerAccountAuthImportのprivateメソッドから切り出し）
  ├─ DbManagerAuthorityManage（正規サービス。現状これを直接呼ぶ呼び出し元は無いが、
  │   他テーブルと同じ粒度で存在させる一貫性のため）
  └─ DbManagerAccountAuthImport（Excel取り込み適用から直接呼ぶ）
```

権限を扱う手動編集・新規追加は、`DbManagerAccountAuthImport`を経由せず、
**`DbManagerTInetUserAuth.update`（`TInetUserAuthBase::update`）自体を拡張**し、
`$info`に`authority`プロパティがあればその場で`AuthorityManageWriter`も呼ぶようにした
（Excelの`changed`行が`authority`を同じオブジェクトに乗せているのと同じ形）。「権限を触らない編集」と
「権限も触る編集」は呼び出し元・件数・レスポンスの形が完全に同じ（同じ編集フォーム、常に1件）なので、
サービスを分けずオプションの属性として扱うのが適切と判断した。

## 既知の制約

- `t_user_authority_manage` は MyISAM でトランザクションが効かない。途中で失敗しても巻き戻せないが、Expressは毎回DBを
  読み直して差分を再計算するため、同じファイルをもう一度取り込めば残りが補われる（冪等）。
- MSWモック（Storybook）はこの判定を再現せず、`entitlementChanges`／`rowErrors` を常に空で返す。見た目は
  `ImportDiffDialog.stories` が差分を直接渡して確認する。
- 2026-11-12、docker-composeでphp-serverを再ビルドし、ローカルで`DbManagerAuthorityManage`・
  `DbManagerTInetUserAuth`のauthority拡張・`DbManagerAccountAuthImport`の切り出し後の動作をgateway.php
  経由で実地検証済み（それまでは`php`がローカルに無く未検証だった）。`t_authority_manage`/
  `t_user_authority_manage`テーブルは、既存のSQLiteファイルが先に作られていたため自動生成されておらず、
  手動でCREATE TABLE＋シードを当てて補った（新規にコンテナを作り直す場合は`DBConnection.php`の初回起動処理で
  自動生成されるため不要）。
