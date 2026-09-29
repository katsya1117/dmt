# Excel取り込み：差分無視Noリスト機能の設計メモ

（作成: 2026-09-29）

## 背景

客先DBと客先管理のExcel（管理簿）の間には、運用上すでに一定数の差異（登録状態や内容の食い違い）がある。この差異は本来是正されるべきだが、Excelは客先のみが触れ、DBも直接触るには許可が要るため、アプリ運用初期は「ズレている状態」を前提に、Excel取り込みの差分プレビューを安全に運用できるようにする必要がある。

対応として、差分プレビュー画面に以下を追加する。

1. **行ごとの選択適用**: 差分プレビュー画面で、どの行を実際にDBへ反映（POST）するか、行単位でチェックボックス選択できるようにする（従来は全件無条件で一括適用していた）。
2. **デフォルト差分無視アカウントNoリスト**: ユーザーが管理できる「アカウントNo」のリスト。このリストに載っているNoの行は、差分としては検出・表示はするが（客先の運用が今後変わりうるため検出自体は止めない）、チェックボックスはデフォルトでOFF（グレーアウト・非選択）にする。
3. **マスクスイッチ**: 無視リストに載っている行を差分プレビュー画面から一時的に隠す表示専用のトグル。選択状態（適用可否の唯一の情報源）には影響しない。
4. 「状況に応じて無視ルールを上書きする」ような条件分岐は、運用のシンプルさを優先し今回は見送り。個別に無視を上書きしたい場合は運用担当者が手動でチェックを入れ直す。

## 無視リストの永続化先

当初はExpress自身のSQLite（`vehicle`/`katashiki`と同じ、客先DBに触れない閉じた実装）も検討したが、**客先側に将来的にこの用途で使えそうなテーブルを用意してもらう想定がある**ため、最初からAMFPHP経由（`account_auth`と同じ構造）で実装する。

客先の実テーブルはまだ確定していない。`account_auth`（`t_inet_user_auth`）を最初に実装した時と同じやり方（`docs/アカウント認証_Excel取り込み設計.md`参照）で、妥当な仮スキーマを決めて実装し、実物の情報が来たら`server/src/repositories/importIgnoreList.ts`とモックPHP（`mock/php-server/webService/amfphp/Services/DbManagerTImportIgnoreNumber.php`）だけを差し替える。呼び出し元（コントローラ・クライアント）は無改修で済む設計にしてある。

## 仮スキーマ（客先へ提示する契約案）

```
t_import_ignore_number（仮称・客先未確定。要確認）
  id          INTEGER PRIMARY KEY
  number      INTEGER NOT NULL   -- アカウントNo（account_auth.numberと同じ意味・同じ値域）
  ignfg       INTEGER DEFAULT 0  -- 論理削除（無視リストから除外）フラグ。account_auth.delfgと同じ考え方
  comment     TEXT NULL          -- 無視する理由の任意メモ
  reg_date    TEXT
  upd_date    TEXT
```

- **物理DELETEは使わない**。`account_auth`で論理削除（`delfg`）が採用されているのは、客先側のDB更新の仕組み（他システムとの同期）が物理削除と相性が悪いことに由来しており、このテーブルも同じ客先DB上に乗る以上、同じ制約を受ける前提で設計する。「無視リストから外す」操作は`ignfg`を1に立てるUPDATEとして扱う。一覧取得は`ignfg=0`の行だけを返せば十分で、リストア相当のUIは今回不要。
- 行の特定は`account_auth`と同じく`id`（DB内部の連番）で行う。`account_auth`が同じ方式で問題なく運用できている実績を踏まえ、ここでも踏襲する。
- `updatemark: INSERT / UPDATE` のみ使用（`DELETE`は使わない）。AMFPHP側のUPDATE文は全カラム上書き固定のため、`ignfg`だけを変えたい場合も現在の行の全カラムを読み直して送り直す必要がある（`account_auth`の削除/リストア処理と同じパターン）。

## AMFPHPサービス契約（仮）

`DbManagerTInetUserAuth`と同じJSON契約（`load`/`update`、`$arg[0] = [userid, key, target, targetTableId, data?]`）を踏襲する。

- `load`: `select * from t_import_ignore_number order by id` 相当。全件（`ignfg`問わず）返す。Express側で`ignfg===0`にフィルタする。
- `update`: `data`は`{updatemark, id?, number, ignfg, comment, reg_date, upd_date}`の配列。`INSERT`で新規登録、`UPDATE`で`ignfg`変更（削除相当）。

客先の実テーブルが用意でき次第、この契約を客先エンジニアと擦り合わせて確定させる。