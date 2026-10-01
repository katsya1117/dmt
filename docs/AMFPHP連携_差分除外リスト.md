# Excel取り込み：差分除外Noリスト機能の設計メモ

（作成: 2026-09-29。2026-10-02に「無視リスト」から「除外リスト」へ呼称変更）

## 【重要】権限管理実装時の対応事項

この機能は「本来はDBまたは管理簿側を是正すべき差分を、見た目上検出させない」という性質を持つ安全弁の消極的な使い方であり、客先が自由に使えてしまうとツールの存在意義（ヒューマンエラー防止）を損なう。**将来の権限管理機能実装時、この管理UIは客先ロールには見せず、社内限定にすること。** 詳細・同じ制約を持つ兄弟機能は`docs/Excel取り込み_比較前値置換ルール.md`参照。

## 背景

客先DBと客先管理のExcel（管理簿）の間には、運用上すでに一定数の差異（登録状態や内容の食い違い）がある。この差異は本来是正されるべきだが、Excelは客先のみが触れ、DBも直接触るには許可が要るため、アプリ運用初期は「ズレている状態」を前提に、Excel取り込みの差分プレビューを安全に運用できるようにする必要がある。

対応として、差分プレビュー画面に以下を追加する。

1. **行ごとの選択適用**: 差分プレビュー画面で、どの行を実際にDBへ反映（POST）するか、行単位でチェックボックス選択できるようにする（従来は全件無条件で一括適用していた）。
2. **デフォルト差分除外アカウントNoリスト**: ユーザーが管理できる「アカウントNo」のリスト。このリストに載っているNoの行は、差分としては検出・表示はするが（客先の運用が今後変わりうるため検出自体は止めない）、チェックボックスはデフォルトでOFF（グレーアウト・非選択）にする。
3. **マスクスイッチ**: 除外リストに載っている行を差分プレビュー画面から一時的に隠す表示専用のトグル。選択状態（適用可否の唯一の情報源）には影響しない。
4. 「状況に応じて除外ルールを上書きする」ような条件分岐は、運用のシンプルさを優先し今回は見送り。個別に除外を上書きしたい場合は運用担当者が手動でチェックを入れ直す。

## 除外リストの永続化先

当初はExpress自身のSQLite（`vehicle`/`katashiki`と同じ、客先DBに触れない閉じた実装）も検討したが、**客先側に将来的にこの用途で使えそうなテーブルを用意してもらう想定がある**ため、最初からAMFPHP経由（`account_auth`と同じ構造）で実装する。

当初は専用テーブル（`t_import_ignore_number`）を新設する案で仮設計していたが、客先に複数機能が相乗りする汎用キー・バリュー設定テーブル`_properties`が既に存在することが分かった（2026-10-01確認）ため撤回し、以下の共有テーブルに乗せる方針に変更した。実物の情報が来たら`server/src/repositories/importExcludeList.ts`とモックPHP（`mock/php-server/webService/amfphp/Services/DbManagerProperties.php`）だけを差し替える想定は変わらない。呼び出し元（コントローラ・クライアント）は無改修で済む設計にしてある。

## 保存先テーブル：`_properties`（共有の汎用設定テーブル、客先で実在確認済み）

```sql
CREATE TABLE IF NOT EXISTS `_properties` (
  `id`            int(10) unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `category_key`  varchar(50) COLLATE utf8_bin NOT NULL COMMENT 'カテゴリキー',
  `category_id`   int(11) NOT NULL COMMENT 'カテゴリID（カテゴリキーとカテゴリIDでUNIQUE）',
  `value1_1`      text COLLATE utf8_bin NOT NULL COMMENT '値1',
  `value1_2`      text COLLATE utf8_bin COMMENT '値2',
  `value1_3`      text COLLATE utf8_bin COMMENT '値3',
  `value1_4`      text COLLATE utf8_bin COMMENT '値4',
  `value1_5`      text COLLATE utf8_bin COMMENT '値5',
  `update_date`   timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時',
  `valid_fg`      tinyint(1) NOT NULL DEFAULT '1' COMMENT '有効/無効フラグ',
  `del_fg`        tinyint(1) NOT NULL DEFAULT '0' COMMENT '削除フラグ',
  PRIMARY KEY (`id`),
  UNIQUE KEY `index_unique_category` (`category_key`, `category_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE=utf8_bin;
```

2026-10-02、客先の実データを確認したところ、同じ`category_key`に対して`category_id`が複数に分岐しているレコードが多数存在し、（`category_key`, `category_id`)のUNIQUE制約の通り使われていることが分かった。ただし`category_id`の値はその行の`id`（AUTO_INCREMENT）とは一致しておらず、**`category_key`内で独立に振られる連番**（1,2,3...のような）であると見られる。他機能が具体的にどういう意図でこの連番を振っているか（単なる慣習か、何らかのツールがこの並びを前提にしているか）を示す資料は無いが、**既存データの見た目の運用パターンに合わせる**方針にした。

- `category_key`: 固定文字列`'account_auth_import_exclude_number'`。他機能と衝突しないよう十分に具体的な名前にしている（要確認：実際に衝突していないか客先に確認が必要）
- `category_id`: `category_key`内の連番（`MAX(category_id) WHERE category_key=...`の次の値）。業務的な意味は持たせない。**採番衝突について**：MyISAM（トランザクション非対応）上でのMAX()+1方式は同時書き込みで衝突しうるが、この機能の書き込み頻度は低い（運用担当者が除外リストを編集する程度）ため許容する。当初は衝突を避けるため`id`（AUTO_INCREMENT）をそのまま流用する案だったが、既存データの`category_id`が`id`と噛み合わず見た目の慣習から外れるため撤回した
- `value1_1`（NOT NULL）: アカウントNo（text型のため文字列化して保存、読み出し時にNumber()へ変換）
- `value1_2`: 除外する理由の任意コメント（NULL可）
- `value1_3`〜`value1_5`: 未使用
- `del_fg`: 除外リストから外す＝1に更新（`account_auth.delfg`と同じ論理削除の考え方。物理DELETEは使わない）
- `valid_fg`: 役割不明のため関与しない（常にデフォルト値1のまま）

## AMFPHPサービス契約（仮）

`_properties`は共有テーブルのため、`load`は`category_key`による絞り込みを必須引数として持つ（無条件の全件取得はしない）。サービス名は仮称`DbManagerProperties`（客先に既存の汎用サービスがある可能性が高いが、無い前提で暫定実装する。実在が確認でき次第、こちらを差し替える）。

```
load($arg): $arg[0] = [userid, key, target, categoryKey]
  → SELECT * FROM _properties WHERE category_key = ? AND del_fg = 0 ORDER BY id

update($arg): $arg[0] = [userid, key, target, data]
  data = [{ updatemark: "INSERT"|"UPDATE", id?, category_key, category_id?, value1_1?, value1_2?, valid_fg?, del_fg? }, ...]
  INSERT: category_idはcategory_key内でMAX(category_id)+1を求めてから採番
  UPDATE: 渡された列だけをSET句に組み込む本当の部分更新（例: {id, category_key, del_fg:true}）。
    WHERE句はid=?に加えcategory_key=?も必須（他機能の行をidだけで誤って
    書き換えてしまう事故を防ぐため。_properties は複数機能の相乗りテーブル）
```

**UPDATE時の部分更新について（2026-10-01方針転換）**: AMFPHPのインターフェース（JSON契約）自体は`DbManagerTInetUserAuth`を踏襲するが、CRUD処理の中身は新アプリ専用の新規実装であり、旧FLEXアプリとは共有しない（AMFPHPのインターフェースだけ流用し、処理は完全に別物）。そのため`DbManagerTInetUserAuth.update()`の「UPDATE文のSET句が全カラム固定」という制約（旧FLEXアプリ時代のレガシーコードに由来し、既存アプリへの影響を避けるため変更できない）を踏襲する理由が無く、`DbManagerProperties.update()`は渡された列だけを更新する設計にした。これにより`importExcludeList.ts`の削除処理は、対象行を読み直さず`{id, del_fg: true}`だけ送ればよい。

**対応済み（2026-10-02）**: 同じ理由（新アプリ専用の新規実装であり、既存アプリとは非共有）が`account_auth`側（`DbManagerTInetUserAuth`）にも当てはまるため、`DbManagerTInetUserAuth.update()`のUPDATE分岐も`DbManagerProperties.php`と同じ方式の本当の部分更新に書き換えた。これに伴い`server/src/repositories/accountAuth.ts`の「現在の行を読み直してから全カラム送り直す」実装（`updateAccountAuth`のパスワード保持処理、`applyAccountAuthImport`の`changed`/`deleted`/`restored`処理）も簡略化し、不要になった`toInput()`は削除した。

**作業中に判明した落とし穴**: mock/php-serverはDockerイメージのビルド時にPHPファイルをコピーする構成（`Dockerfile`の`COPY ./webService ...`）のため、ホスト側のファイルを編集しただけでは稼働中のコンテナに反映されない。`docker-compose up -d --build`で再ビルドし直すまで、古い「全カラム固定」のコードが動き続ける（検証時、再ビルドを忘れて実行し、他カラムがNULLで上書きされる事故を一度起こした→再ビルド後に解消・データ復旧して確認し直した）。モックPHPを修正した際は必ず再ビルドすること。

**呼称について（2026-10-02）**: 機能名を「無視リスト」から「除外リスト」に変更した。「無視」という言葉が「既知の問題を見過ごす」というネガティブな響きを持つのに対し、実際の意図は「客先管理簿とDBの既知の食い違いを、客先側で是正されるまでの間、意図的に自動反映しない」というもので、「除外」の方が中立的に意図を表せると判断した。コード識別子（`category_key`文字列含む）・UI文言・ファイル名をすべて揃えて変更済み（客先の実テーブルにはまだ書き込んでいないタイミングだったため、移行コストなく変更できた）。

客先の実際のサービスクラス・採番方式が判明したら、このドキュメントと`server/src/repositories/importExcludeList.ts`・モックPHP（`DbManagerProperties.php`）を合わせて更新する。
