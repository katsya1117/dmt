# AMFPHP連携（レガシー経由でのAPI実装方針）

（作成: 2026-08-19。account-auth機能を題材に実装したパイロット。他のAPIを追加する際もこのパターンをベースにする）

## 1. 背景・方針

客先DBを直接叩くAPIをExpressで新規に書くのではなく、**旧FLEX/AIRアプリが使っていたAMFPHP（レガシーPHP資産）のJSONプラグインをExpressから呼び出す**形でAPIを用意していく方針とした。理由は、業務ロジック（DBのCRUD）が既にAMFPHPの`DbManagerXxx`系サービスクラスに存在しており、それを再利用した方が早いため。ただし**将来的にAMFPHPは廃止したい**という前提があるため、AMFPHP固有の知識（契約の形）を1箇所に閉じ込め、置き換えコストを最小化する設計にしてある。

- 全体方針・repository層が差し替え点であることは[README](README.md)の「確定している中核方針」、[08_API仕様書 §6](design/08_API仕様書.md#6-未確定・要検討事項)、[アカウント認証_Excel取り込み設計.md](アカウント認証_Excel取り込み設計.md)の「PHPは書き足すのか」を参照
- AMFPHP側の実物（レガシーコード）の調査・復元経緯は[legacy-amfphp/](legacy-amfphp/)を参照

## 2. レイヤ構成

```
[Reactクライアント]
      ↕ REST（無変更）
[Express コントローラ（tsoa）]         … 無改修。AMFPHPの存在を意識しない
      ↕
[Express リポジトリ]                  … AccountAuth型 ⇄ PHP側の行 の変換のみ担当
  server/src/repositories/accountAuth.ts
      ↕
[amfphpClient.ts]                     … AMFPHP固有の配線をここに閉じ込める
  server/src/services/amfphpClient.ts
      ↕ POST {serviceName, methodName, parameters}
[gateway.php]（客先PHP／開発中はmock）
      ↕
[DbManagerXxx サービスクラス]（例: DbManagerTInetUserAuth）
      ↕
[DB]
```

**置き換えコストを抑える設計判断**：AMFPHPの契約（`{serviceName, methodName, parameters}`という位置引数と`$resultValue`の`{code, errorcode, errormsg, output}`エンベロープ）を知っているのは`amfphpClient.ts`だけ。リポジトリはこのクライアントを呼んでアプリのドメイン型（`AccountAuth`等）に変換するだけで、AMFPHPの契約そのものは知らない。将来AMFPHPを廃止して素のRESTに置き換える時は、`amfphpClient.ts`を新しいHTTPクライアントに差し替えれば、コントローラはもちろんリポジトリの型・関数シグネチャも無改修で済む。

## 3. ファイル一覧

| ファイル | 役割 |
|---|---|
| `server/src/config.ts`の`amfphp`セクション | 接続設定（`gatewayUrl`/`userid`/`key`）。環境変数で上書き可能。`target`は含まない（§4参照、コード側で固定） |
| `server/src/services/amfphpClient.ts` | `callAmfphpService(serviceName, methodName, args)`。AMFPHP契約の唯一の実装場所。`target`（プライマリ/レプリカ選択）もここで`0`固定にしている |
| `server/src/repositories/accountAuth.ts` | account-auth機能の実例。`DbManagerTInetUserAuth`のload/updateを呼び、`AccountAuth`/`AccountAuthInput`型との変換を行う |
| `server/src/scripts/verifyAmfphpClient.ts`（`yarn verify:amfphp`） | `amfphpClient.ts`単体の疎通確認（load→INSERT→load） |
| `server/src/scripts/verifyApplyImport.ts`（`yarn verify:apply-import`） | Excel取り込みの削除/リストア（§5参照）が他カラムを壊さないかの確認 |
| `mock/php-server/webService/amfphp/gateway.php` | AMFPHPゲートウェイ互換のモック（開発用）。本番と同じURLパス（`/webService/amfphp/gateway.php`） |
| `mock/php-server/webService/amfphp/Services/AuthSession.php` | 本物の`AuthSession`と同じインターフェース（`checkLogin`/`connectionDb`）のモック。`DbManagerTInetUserAuth`はこれ経由でDB接続を得る（本物の構造をそのまま再現） |
| `mock/php-server/webService/amfphp/Services/DbManagerTInetUserAuth.php` | `DbManagerTInetUserAuth`のload/update契約をSQLiteで再現した簡易モック。DBアクセスは自前のPDO呼び出しではなく`AuthSession`→`DBConnection`経由 |
| `mock/php-server/webService/lib/DBConnection.php` | 本物の`DBConnection`と同じインターフェース（`connect`/`query`/`execute`/`close`等）のSQLite向けモック |

## 4. 環境の切り替え（本物のAMFPHP／DBへ持っていく時）

**コードの配線自体は変更不要**という設計。切り替えは環境変数だけで完結する想定。

| 環境変数 | 開発（このMac、mock使用） | 本番（客先AMFPHP／DB） |
|---|---|---|
| `PHP_API_URL` / `AMFPHP_GATEWAY_URL` | `http://localhost:8080`（mock/php-server） | 客先サーバーのURL |
| `AMFPHP_USERID` / `AMFPHP_KEY` | `TODO`（モックは非空なら通す） | 実際の認証情報（§6参照、未確定） |

`target`（`AuthSession::connectionDb($select)`の引数。0=プライマリDB/0以外=レプリカDB）は環境変数化していない。`amfphpClient.ts`内で`0`（プライマリ）固定にしている。理由：このアプリの規模ではレプリカで負荷分散する積極的な理由が無い一方、`updateAccountAuth`等が書き込み直後に同じデータを読み直す実装になっており、レプリカの反映遅延で古い値を読んでしまうリスクの方が大きいため（2026-08-27判断）。

ただし以下は**コード配線とは別に確認が必要**（「動くはず」で終わらせず、実機で必ず検証する）：

1. **本物の`DbManagerTInetUserAuth.php`が実際に動く状態か**。`mysql_errno()`/`mysql_error()`（PHP7で廃止された関数呼び出し）やPHP4スタイルコンストラクタは、このリポジトリ内の控え（`docs/legacy-amfphp/`配下）では全ファイル横断で修正・再確認済み（2026-08-20、PHP8.3での構文チェック＋手動精査。PHP8.4のイメージはネットワーク制限で取得できず未検証）。ただし**客先に実際にデプロイされているコードが同じ状態とは限らない**。本番接続前に要確認
2. **モックは簡略化した再現に過ぎない**。LPADのフォーマットや電子マニュアル権限の連動削除など、本物固有の業務ロジックまでは再現していないため、モックで通ったからといって本物でも同じ結果になる保証はない
3. **本物のAMFPHP JSONプラグインが`parameters`を連想配列として渡してくる前提でよいか（要注意）**。`DbManagerTInetUserAuth.php`・`AuthSession.php`（客先実物のOCR復元版）はどちらも`$info["username"]`・`$arg[0][0]`のような配列アクセスを一貫して使っている。これは本物のJSONプラグインが`json_decode($json, true)`のように連想配列へデコードしていることが前提になっているコードで、もし本物が`stdClass`（`json_decode`の第2引数を省略した場合の既定の挙動）で渡してきていたら、配列アクセスの箇所で`Cannot use object of type stdClass as array`のような実行時エラーになる。このモック（`mock/php-server/webService/amfphp/gateway.php`）は`json_decode(..., true)`を明示しているため問題ないが、**本物が同じ実装とは限らない**。実物の`DbManagerTInetUserAuth.php`が現に配列アクセスで書かれ本番で動いている以上、本物も連想配列で渡している可能性が高いという状況証拠はあるが、確証ではない。本番接続時に最初に疑うべき箇所の1つ
4. `TARGET_TABLE_ID = 0`（`t_inet_user_auth`固定）で正しいか（§6）
5. `userid`/`key`の実際の値・発行方法（§6）

## 5. 既知の制約：AMFPHPには部分更新が無い

`DbManagerTInetUserAuth.update()`のUPDATE文は、列を選んで更新する仕組みが無く**常に全カラムを上書き**する（SET句が固定）。そのため、Excel取り込みの削除/リストア（本来`delfg`と`comment`だけ変えたい操作）をそのまま送ると、他のカラムがnullで潰れる。

対処として、`applyAccountAuthImport`は削除/リストア対象行について**送信前に現在の全カラム値を読み直し（`listAllAccountAuth`）、変更したい列だけ上書きしてから丸ごと送り直す**（`accountAuth.ts`の`toInput`・`currentById`）。`verifyApplyImport.ts`で他カラムが消えないことを確認済み。

## 6. 既知の制約：`listAllAccountAuth()`が不完全な結果を返す可能性（本番で確認済み）

2026-08-28、本番環境でCREATE（追加）が成功レスポンスを返すのに一覧の件数が増えない現象が発生。原因は未特定（AMFPHP側かネットワーク経路かは切り分け中）だが、**「通信自体は成功したのに中身が不完全」というケースが実在することが分かった**。

これにより、No./accountNameの重複チェック（`accountAuthController.ts`）とExcel取り込みの差分計算（`accountAuthImportController.ts`）が抱えるリスクが顕在化した：どちらも`listAllAccountAuth()`の結果を「DBの現在の全件」として信用しきっており、結果が不完全でも通信が成功していればエラーにならず、**重複チェックのすり抜け**や**既存行を新規追加と誤判定して二重登録**が起こり得る。

**暫定対処**（2026-08-28実装）：`accountAuth.ts`に`assertAccountAuthListLooksValid()`を追加し、`listAllAccountAuth()`の結果が**空配列**だった場合は「取得に問題がある」signalとして扱い、list（一覧表示）・create・update・import(preview・apply)すべてを503エラーで中断するようにした。本番のaccount_authが実質0件になることは想定していないため（既存レガシーデータ7000件超が既に入っており、物理削除機能も無い）、空配列であること自体を異常検知に使っている。一覧表示も対象にしたのは、これを対象外にすると「一覧はエラーにならず空で表示され、新規追加ダイアログのNo.提案値がその空データから誤って計算される」という別の穴が残るため（2026-08-28、レビューで指摘）。

**この対処で防げないもの**：空でないが一部だけ欠けている（例: 7000件のうち4000件しか返ってこない）ケースは検知できない。これは「件数が正しいか」を判定する独立した基準（客先側の実際の件数等）が無いと原理的に検知できないため、今回のCREATE不具合の根本原因が分かった段階で、より確実な対処に見直す必要がある。

## 7. 未確定事項（実環境で確定すべき）

`AuthSession.php`の実体は2026-08-20に確認できた（[docs/legacy-amfphp/webService/amfphp/Services/AuthSession.php](legacy-amfphp/webService/amfphp/Services/AuthSession.php)）。分かったこと・残る不明点は以下。

| # | 項目 | 状況 |
|---|---|---|
| 1 | `target`（`connectionDb($select)`の引数）の意味 | **確定**。客先/契約単位のコードではなく「0=プライマリDB / 0以外=レプリカDB」の二値だった。`amfphpClient.ts`内でプライマリ(`0`)固定に決定済み（環境変数化していない、§4参照） |
| 2 | `userid`/`key`の実際の値・発行方法 | `checkLogin()`が`t_mng_admin`テーブルの`id`/`certificationkey`列と照合していることは分かったが、Express用にどの値を発行してもらうかは未確定。固定値`TODO`のまま |
| 3 | `ManagerAuth.php`が未入手 | `AuthSession.php`が`require_once`しており、`checkLogin`のログイン失敗時に`ManagerAuth::addUserAuthLogAtId(...)`を呼ぶ。ファイル自体が無いと`require_once`の時点でFatal Errorになるため、本番接続前に入手が必要 |
| 4 | `R_DB_*`・`LOG_DB_*`・`LOG_R_DB_*`・`HTML_LOG_*`・`REQUEST_CHECK`等の定数が`config.php`に無い | `AuthSession.php`が参照している定数群が、このリポジトリの`docs/legacy-amfphp/webService/config.php`（ダミー版）には定義されていない。`config.real.php`側には存在するはずだが未確認 |
| 5 | `TARGET_TABLE_ID`（`t_inet_user_auth` vs `t_inet_user_auth_ds3`のどちらを使うか） | **確認済み（2026-08-28）**。`t_inet_user_auth`（`0`固定のまま）で正しい |
| 6 | CREATE成功レスポンスなのに一覧の件数が増えない（2026-08-28発生） | **原因未特定**。クライアント側キャッシュではない（リロードしても増えない）ことは確認済み。ロードバランサ構成・AMFPHPの生レスポンス・繰り返し実行時の挙動を確認中。§6の暫定対処（空配列検知）はこの不具合の症状の一部を防ぐものであり、根本原因の解決ではない |

## 8. 関連ドキュメント

- レガシーPHPコードの復元・修正の経緯: `docs/legacy-amfphp/`配下
- account-auth機能のAPI契約・型: [design/account-auth/10_詳細設計.md](design/account-auth/10_詳細設計.md)
- 全体のAPI一覧・エラー規約: [design/08_API仕様書.md](design/08_API仕様書.md)
