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
| `server/src/config.ts`の`amfphp`セクション | 接続設定（`gatewayUrl`/`userid`/`key`/`target`）。すべて環境変数で上書き可能 |
| `server/src/services/amfphpClient.ts` | `callAmfphpService(serviceName, methodName, args)`。AMFPHP契約の唯一の実装場所 |
| `server/src/repositories/accountAuth.ts` | account-auth機能の実例。`DbManagerTInetUserAuth`のload/updateを呼び、`AccountAuth`/`AccountAuthInput`型との変換を行う |
| `server/src/scripts/verifyAmfphpClient.ts`（`yarn verify:amfphp`） | `amfphpClient.ts`単体の疎通確認（load→INSERT→load） |
| `server/src/scripts/verifyApplyImport.ts`（`yarn verify:apply-import`） | Excel取り込みの削除/リストア（§5参照）が他カラムを壊さないかの確認 |
| `mock/php-server/webService/amfphp/gateway.php` | AMFPHPゲートウェイ互換のモック（開発用）。本番と同じURLパス（`/webService/amfphp/gateway.php`） |
| `mock/php-server/webService/amfphp/Services/DbManagerTInetUserAuth.php` | `DbManagerTInetUserAuth`のload/update契約をSQLiteで再現した簡易モック |

## 4. 環境の切り替え（本物のAMFPHP／DBへ持っていく時）

**コードの配線自体は変更不要**という設計。切り替えは環境変数だけで完結する想定。

| 環境変数 | 開発（このMac、mock使用） | 本番（客先AMFPHP／DB） |
|---|---|---|
| `PHP_API_URL` / `AMFPHP_GATEWAY_URL` | `http://localhost:8080`（mock/php-server） | 客先サーバーのURL |
| `AMFPHP_USERID` / `AMFPHP_KEY` | `TODO`（モックは非空なら通す） | 実際の認証情報（§6参照、未確定） |
| `AMFPHP_TARGET` | `TODO` | 実際のtarget値（§6参照、未確定） |

ただし以下は**コード配線とは別に確認が必要**（「動くはず」で終わらせず、実機で必ず検証する）：

1. **AuthSession.phpの実体**（§6）。`checkLogin`/`connectionDb`の中身次第では、`amfphpClient.ts`の認証情報の渡し方自体を見直す必要がある
2. **本物の`DbManagerTInetUserAuth.php`が実際に動く状態か**。`docs/legacy-amfphp/webService/lib/DBConnection.php`で見つかった`mysql_errno()`/`mysql_error()`（PHP7で廃止された関数呼び出し）やPHP4スタイルコンストラクタは、このリポジトリ内の控え（`docs/legacy-amfphp/`配下）では修正済みだが、**客先に実際にデプロイされているコードが同じ状態とは限らない**。本番接続前に要確認
3. **モックは簡略化した再現に過ぎない**。LPADのフォーマットや電子マニュアル権限の連動削除など、本物固有の業務ロジックまでは再現していないため、モックで通ったからといって本物でも同じ結果になる保証はない
4. `TARGET_TABLE_ID = 0`（`t_inet_user_auth`固定）で正しいか（§6）

## 5. 既知の制約：AMFPHPには部分更新が無い

`DbManagerTInetUserAuth.update()`のUPDATE文は、列を選んで更新する仕組みが無く**常に全カラムを上書き**する（SET句が固定）。そのため、Excel取り込みの削除/リストア（本来`delfg`と`comment`だけ変えたい操作）をそのまま送ると、他のカラムがnullで潰れる。

対処として、`applyAccountAuthImport`は削除/リストア対象行について**送信前に現在の全カラム値を読み直し（`listAllAccountAuth`）、変更したい列だけ上書きしてから丸ごと送り直す**（`accountAuth.ts`の`toInput`・`currentById`）。`verifyApplyImport.ts`で他カラムが消えないことを確認済み。

## 6. 未確定事項（実環境で確定すべき）

| # | 項目 | 現状の仮値 | 確認先 |
|---|---|---|---|
| 1 | `AuthSession.php`の実体（`checkLogin`/`connectionDb`の中身） | 使われ方からの推測のみ | Linux開発環境（実物のAMFPHPが動いている） |
| 2 | `target`（`connectionDb($target)`の引数）が何を指すか | 固定値`TODO` | 同上 |
| 3 | `userid`/`key`の実際の値・発行方法 | 固定値`TODO` | 同上 |
| 4 | `TARGET_TABLE_ID`（`t_inet_user_auth` vs `t_inet_user_auth_ds3`のどちらを使うか） | `0`固定 | 業務仕様確認 |

## 7. 関連ドキュメント

- レガシーPHPコードの復元・修正の経緯: `docs/legacy-amfphp/`配下
- account-auth機能のAPI契約・型: [design/account-auth/10_詳細設計.md](design/account-auth/10_詳細設計.md)
- 全体のAPI一覧・エラー規約: [design/08_API仕様書.md](design/08_API仕様書.md)
