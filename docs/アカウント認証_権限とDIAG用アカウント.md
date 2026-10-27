# アカウント認証：権限とDIAG用アカウント

（作成: 2026-10-28。Excel取り込みで、権限（`t_user_authority_manage`）とDIAG用アカウントを同時に扱う仕様と実装メモ。
判定ルールの実装は `server/src/services/accountAuthEntitlement.ts`、差分計算は `accountAuthDiff.ts`）

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
| PHP | `DbManagerTInetUserAuth` / `DbManagerTInetUserAuthDiag`（load/update。実装は `lib/TInetUserAuthBase.php` 共通）、`DbManagerAccountAuthImport`（`loadAuthorities`／`apply`：通常・DIAG用・権限をまたぐ専用メソッド） |

`apply` は通常アカウントを INSERT した直後の `lastInsertId` で権限を書く。`account_type` は通常/DIAGを区別する列ではない
（ユーザー確認）ため、旧PHPが電子マニュアルアカウントの権限行に使っていた `0` を固定で使う。

## 既知の制約

- `t_user_authority_manage` は MyISAM でトランザクションが効かない。途中で失敗しても巻き戻せないが、Expressは毎回DBを
  読み直して差分を再計算するため、同じファイルをもう一度取り込めば残りが補われる（冪等）。
- MSWモック（Storybook）はこの判定を再現せず、`entitlementChanges`／`rowErrors` を常に空で返す。見た目は
  `ImportDiffDialog.stories` が差分を直接渡して確認する。
- PHPはローカルに `php` が無い環境では実行・構文チェックができていない（`yarn dev` での確認が必要）。
