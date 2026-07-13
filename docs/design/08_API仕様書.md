# API仕様書（アプリ全体）

（作成: 2026-07-14。`server/src/index.ts`・`server/src/routes/*.ts`・`server/src/controllers/*.ts`の実装を基に作成。レイヤ構成・エラー規約の設計判断は[アプリケーション方式設計書](07_アプリケーション方式設計書.md)、account-auth機能の詳細な契約は[account-auth/10_詳細設計.md](account-auth/10_詳細設計.md)を参照。本書はAPI全体を俯瞰する一覧）

## 1. 全体構成：2種類のルート実装が混在する

現状、ExpressのAPIは実装方式が異なる2系統が同居している。

| 系統 | 実装場所 | 検証・型 | 対象 |
|---|---|---|---|
| **手書きルート** | `server/src/routes/*.ts`（`Router`を手書き、`index.ts`で`app.use`） | 手書き（型検証なし） | katashiki・upload・jobs・master |
| **tsoa生成ルート** | `server/src/controllers/*.ts`（デコレータ）→ `yarn gen:api`で`generated/routes.ts`を自動生成 | tsoaが型から自動検証・OpenAPI仕様を生成 | account-auth（CRUD・Excel取り込み） |

`server/src/index.ts`では手書きルートを先にマウントし、`RegisterRoutes(app)`でtsoa生成ルートを後から一括登録する。

**将来の移行方針**：手書きルート（katashiki/upload/jobs/master）は、[画面実装パターン](../画面実装パターン.md)にある通り**順次tsoaコントローラへ移行**する予定。移行後は全APIの型・検証・OpenAPI仕様がtsoaに一本化される。

## 2. エンドポイント一覧

### 2.1 手書きルート

| メソッド | パス | 説明 | 主なレスポンス |
|---|---|---|---|
| GET | `/api/katashiki` | Sambaフォルダのサブディレクトリ名から型式一覧を返す（`{id, label}[]`） | 200 / 503（Sambaフォルダが見つからない） |
| GET | `/api/katashiki/:id/files` | 型式別のアップロード対象ファイル一覧（`config.resourceTypes`で拡張子フィルタ） | 200 / 404（型式フォルダなし） |
| POST | `/api/upload/:id` | 型式フォルダの対象ファイルを顧客PHP（`${PHP_API_URL}/api/upload.php`）へmultipart転送 | 200 / 400（対象ファイルなし） / 404（型式フォルダなし） / 502（PHP側エラー） |
| GET | `/api/master/vehicles` | 車種一覧 | 200 |
| GET | `/api/master/katashiki?vehicleId=` | 型式一覧（`vehicleId`で車種に絞り込み可） | 200 |
| POST | `/api/jobs/process-a` | 処理A（VB）の呼び出し口。**未実装** | 501 |
| POST | `/api/jobs/process-b` | 処理B（Python+Adobe）の呼び出し口。**未実装** | 501 |

### 2.2 tsoa生成ルート（account-auth）

| メソッド | パス | リクエスト | レスポンス | ステータス |
|---|---|---|---|---|
| GET | `/api/account-auth` | クエリ`includeDeleted?: boolean` | `AccountAuth[]` | 200 |
| POST | `/api/account-auth` | `{ records: AccountAuthInput[] }` | `{ inserted: number }` または `{ error }` | 201 / 409 |
| PUT | `/api/account-auth/{id}` | `AccountAuthInput` | `AccountAuth` または `{ error }` | 200 / 404 / 409 |
| ~~DELETE~~ | ~~`/api/account-auth/{id}`~~ | - | - | **未開放**（コントローラ内でコメントアウト。客先DBで物理削除が不調なため。論理削除は`delfg`を含めてPUTで更新する） |
| POST | `/api/account-auth/import/preview` | `multipart/form-data`（フィールド名`file`） | `ImportDiff`（差分。DBへの書き込みなし） | 200 |
| POST | `/api/account-auth/import/apply` | 同上 | `ApplyImportResult` または `{ error, errors? }` | 200 / 400 |

型定義・差分判定ロジック・関数レベルの詳細は[account-auth/10_詳細設計.md](account-auth/10_詳細設計.md)を参照。

## 3. エラー規約

ステータスコードの使い分けは[アプリケーション方式設計書 §3](07_アプリケーション方式設計書.md#3-例外処理方式)を正とする。要約：

| コード | 意味 | 発生元 |
|---|---|---|
| 422 | tsoaの型検証エラー（`details`にフィールド別メッセージ） | コントローラ（tsoaルートのみ） |
| 409 | UNIQUE制約違反（例: username重複） | リポジトリ→コントローラ |
| 404 | 対象が見つからない | コントローラ |
| 500 | 未分類のサーバーエラー | Expressのエラーハンドラ |
| 413 | アップロードデータが大きすぎる | multer |
| 501 | 未実装（処理A/B） | コントローラ／ルート |
| 502 | 上流（顧客PHP）のエラー | アップロード中継ルートのみ |
| 503 | 前提となるリソース（Sambaフォルダ）が無い | katashikiルートのみ |

手書きルートは422を返さない（型検証が無いため）。tsoa移行後はこの非対称性も解消される見込み。

## 4. Swagger UI（対話的APIドキュメント）

- URL: `http://localhost:3001/api-docs`
- **tsoa生成ルートのみ**掲載される（`server/src/generated/swagger.json`）。手書きルート（katashiki/upload/jobs/master）はSwagger UIに現れない
- 仕様の更新は `yarn gen:api`（`tsoa spec-and-routes`）でコントローラの型から再生成する。手動でswagger.jsonを編集しない
- クライアント側の型（`client/src/api/generated/schema.ts`）もこの仕様から生成される（`openapi-typescript`）。client/serverで型を二重に書かない

## 5. 設定値

`server/src/config.ts`で管理。

| 項目 | 環境変数 | 開発時の既定値 |
|---|---|---|
| ポート | `PORT` | `3001` |
| Sambaマウントパス | `SAMBA_PATH` | `../mock/samba` |
| 顧客PHPサーバーURL | `PHP_API_URL` | `http://localhost:8080` |
| リソース種別 | （コード直書き） | xml / pdf / swf / svg / db |

## 6. 未確定・要検討事項

- 手書きルートのtsoa移行時期・順序
- 客先DBへの実接続時、account-authのリポジトリが呼ぶ顧客PHP側APIの契約（エンドポイント・認証方式）は未確定（[アカウント認証_Excel取り込み設計.md](../アカウント認証_Excel取り込み設計.md)「PHPは書き足すのか」参照）
- 認証・認可（誰がどのAPIを叩けるか）はAPIレベルでは未実装。別途認証・認可設計が必要
