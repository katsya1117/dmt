# Xdebugセットアップ手順（初めての人向け）

対象：客先サーバー上のPHPコードを、VSCodeでブレークポイントを置いて1行ずつ追いたい場合の手順。Xdebugを一度も使ったことがない前提で、仕組みの説明から書く。

**前提**：客先の本番サーバーが対象になる想定。本番への拡張機能インストールは負荷・セキュリティ面でリスクがあるため、可能なら検証用環境（ステージング）を用意してもらってから行うこと（[デバッグ手順.md](./デバッグ手順.md)の「レベル3」参照）。

---

## 0. まず仕組みを理解する（ここが一番大事）

普段のWeb開発（例えばこのプロジェクトのExpress）は、自分のPC上でサーバーもブラウザも動いているので「デバッグする」というのは自分のPCの中で完結する。

Xdebugはそれと違う。図にするとこう：

```
[あなたのPC]                          [客先サーバー]
  VSCode（待ち受け状態）  <-----------  PHP + Xdebug拡張機能
       ↑ ここで「9003番ポートで                ↑
         接続を待つ」状態にしておく    リクエストが来ると、Xdebugが
                                       あなたのPCの9003番ポートに
                                       「自分から」接続しにいく
```

ポイントは、**接続を開始するのはサーバー側（Xdebug）で、あなたのPC（VSCode）は「待つ」側**ということ。普通「リモートに繋ぎに行く」イメージを持ちがちだが逆。

そして客先サーバーからあなたのPCへは、普通は直接繋がらない（あなたのPCは会社のネットワークの内側にいて、外から到達できるグローバルIPを持っていないことがほとんど）。そこで、**SSHの「リモートポートフォワーディング」**という仕組みで、「サーバーからは自分自身(127.0.0.1)の9003番ポートに繋いでいるつもりが、実はSSHのトンネルを通ってあなたのPCの9003番ポートに繋がる」という抜け道を作る。この手順の6割は「このトンネルを正しく掘ること」だと思ってよい。

---

## 1. 事前確認（サーバーにSSHで入れることが前提）

```bash
ssh user@customer-server.example.com
```

サーバーに入ったら、以下を確認してメモしておく。

```bash
cat /etc/os-release        # OSの種類（Ubuntu/CentOS等）
php -v                     # PHPのバージョン
php --ini                  # 使われているphp.iniの場所
sudo -l                    # sudo権限があるか
ps aux | grep -E 'apache|php-fpm|nginx'   # PHPがどう動いているか
```

`php --ini`は実行方法（Webからのリクエスト用 or コマンドライン用）によって別のiniファイルを見ていることが多い点に注意。**編集すべきは「Webからのリクエストで実際に使われる方」**（Apacheと一緒に動くPHPモジュール用、またはPHP-FPM用のphp.ini）。CLI用のphp.iniを直しても、ブラウザ経由のデバッグには反映されない。

---

## 2. サーバーにXdebugをインストールする

PHPのバージョンに自動で合わせてくれる`pecl`コマンド経由が一番確実。

### Ubuntu/Debian系の場合
```bash
sudo apt-get update
sudo apt-get install php-dev php-pear build-essential
sudo pecl install xdebug
```

### CentOS/Amazon Linux系の場合
```bash
sudo yum install php-devel php-pear gcc make
sudo pecl install xdebug
```

`pecl install xdebug`を実行すると、最後に

```
You should add "zend_extension=xdebug.so" to php.ini
```

のようなメッセージと、実際の`.so`ファイルのパスが表示される。これを次のステップで使うのでメモしておく。

---

## 3. php.iniに設定を追加する

ステップ1で確認した「Webからのリクエストで使われるphp.ini」を編集する（`sudo vi` や `sudo nano` 等）。ファイルの末尾に以下を追記する。

```ini
zend_extension=xdebug.so
xdebug.mode=debug
xdebug.start_with_request=trigger
xdebug.client_host=127.0.0.1
xdebug.client_port=9003
xdebug.idekey=VSCODE
```

それぞれの意味：

- `zend_extension=xdebug.so`：Xdebug拡張機能自体を読み込む設定。パスが違う場合は`pecl install`の出力に出たフルパスを書く
- `xdebug.mode=debug`：Xdebugには複数の機能（プロファイラ、カバレッジ測定等）があるが、今回使うのは「ステップデバッグ」機能だけなのでこれだけ有効にする
- `xdebug.start_with_request=trigger`：全リクエストで毎回デバッグを開始すると重い（かつ関係ない一般利用者のアクセスまで巻き込む）ので、「特定の合図（トリガー）が付いたリクエストの時だけ」デバッグを開始する設定にする。合図の付け方は7章で説明する
- `xdebug.client_host=127.0.0.1`：接続先。6章で作るSSHトンネルを使う前提なら、サーバーから見て「自分自身(127.0.0.1)」で正しい（トンネルがそこにいるので）
- `xdebug.client_port=9003`：Xdebug3系のデフォルトポート。VSCode側の設定（8章）とここは必ず同じ数字にする
- `xdebug.idekey=VSCODE`：複数人が同時に同じサーバーをデバッグする場合に混線しないようにする識別子。1人だけなら省略しても動くことが多いが、明示しておくと安心

---

## 4. PHPを再起動して設定を反映する

```bash
# Apacheと一緒にPHPが動いている場合
sudo systemctl restart apache2
# PHP-FPMの場合（バージョン番号は環境に合わせる）
sudo systemctl restart php8.1-fpm
```

どちらで動いているか分からない場合は、ステップ1で確認した`ps aux`の結果を見る。

---

## 5. インストールされたか確認する

```bash
php -v
```
出力に `with Xdebug v3.x.x` のような行が増えていればOK。

```bash
php -m | grep -i xdebug
```
`xdebug`という行が出れば読み込まれている。

もし出ない場合：
- `zend_extension`のパスが間違っている
- 編集したphp.iniが、実際にWebサーバーが読んでいるphp.iniと違うファイルだった
のどちらかが多い原因。

---

## 6. SSHポートフォワーディング（トンネル）を張る

**ここからは「あなたのPCのターミナル」で実行する**（サーバーの中ではない）。

```bash
ssh -R 9003:127.0.0.1:9003 user@customer-server.example.com
```

- `-R`：リモート（サーバー側）からローカル（あなたのPC）へのポート転送、という意味の指定
- `9003:127.0.0.1:9003`：「サーバー側の9003番ポートへの接続を、あなたのPCの127.0.0.1:9003（＝あなたのPC自身）へ転送する」という設定

このコマンドを実行すると、そのままSSHでサーバーにログインした状態になる。**このターミナルは閉じずに、デバッグが終わるまで開いたままにする**（閉じるとトンネルも切れる）。デバッグ用の別の操作は、別のターミナルタブ・ウィンドウで行う。

---

## 7. VSCode側の準備

1. VSCodeの拡張機能タブ（`Cmd+Shift+X`）で **「PHP Debug」**（発行元：xdebug.php-debug）を検索してインストール
2. このプロジェクト（`/Users/kty/Documents/_dev/d/maintenance`）に`.vscode/launch.json`を作る（無ければVSCodeが「実行とデバッグ」パネルの「launch.jsonファイルを作成」から雛形を作ってくれる）
3. 中身を以下のようにする

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Listen for Xdebug",
      "type": "php",
      "request": "launch",
      "port": 9003,
      "pathMappings": {
        "/var/www/customer-server/webService": "${workspaceFolder}/docs/legacy-amfphp/webService"
      }
    }
  ]
}
```

- `"port": 9003`：3章の`xdebug.client_port`と必ず一致させる
- `pathMappings`：**サーバー上の実際のファイルパス（左側）**と、**あなたのPC上でVSCodeが開いているファイルのパス（右側）**を対応づける設定。ここが合っていないと、ブレークポイントでは止まるのに「ソースが見つかりません」と出たり、無関係なファイルが開いたりする。左側のサーバー上の実際のパスは、1章でSSHログインした状態で`pwd`や`find / -name gateway.php`などで確認しておく

---

## 8. 実際にデバッグしてみる

1. VSCode左側の「実行とデバッグ」パネル（虫のアイコン）を開き、上部のドロップダウンで「Listen for Xdebug」を選んで再生ボタン（▷）を押す。VSCodeが9003番ポートで待ち受け状態になる（画面下のステータスバーがオレンジ色になるのが目印）
2. 見たい処理（例：`HelloWorldService.php`の`callCarInformation`の中）の行番号の左側をクリックし、赤い丸（ブレークポイント）を置く
3. 6章のSSHトンネルが繋がったままであることを確認する（別のターミナル）
4. ブラウザで`index.html`を開く。**ただし普通にボタンを押すだけではデバッグは始まらない**（`xdebug.start_with_request=trigger`にしたため）。トリガーの付け方は2通り：
   - **クエリパラメータ方式**：`index.html`のURLの末尾に`?XDEBUG_TRIGGER=1`を付けて開く（例：`https://customer-server.example.com/Example/index.html?XDEBUG_TRIGGER=1`）。ただしこの方法は「ページ自体」にトリガーが付くだけなので、fetchで別途POSTしている`gateway.php`側には効かないことがある。より確実なのは次の方法
   - **ブラウザ拡張機能方式**：Chromeなら「Xdebug helper」という拡張機能を入れ、ツールバーのアイコンをクリックして「Debug」モードにしてからページを操作する（これだと以降のfetchも含め全リクエストにトリガーが付く）。**こちらを推奨**
5. ボタン（`get car information`等）を押すと、サーバー側のPHPがVSCodeに接続してきて、ブレークポイントを置いた行で処理が一時停止する
6. VSCode上で、左側に変数の中身（`$carCd`の値など）が見える。ステップ実行ボタン（次の行に進む／関数の中に入る等）で1行ずつ追える

---

## 9. 終わったら（後片付け）

- ブラウザ拡張機能のXdebug helperを「Disable」に戻す（付けっぱなしだと以降のアクセスも巻き込む）
- SSHトンネルのターミナルで`Ctrl+C`してトンネルを切る
- 本番サーバーであれば、可能なら`xdebug.mode=off`に戻すか、検証が終わったらXdebug自体をアンインストールする（`sudo pecl uninstall xdebug`）。常時有効のままだと処理が重くなる
- `sudo systemctl restart apache2`（またはphp-fpm）で設定を反映し直す

---

## トラブルシューティング

| 症状 | 原因候補 |
|---|---|
| ブレークポイントで止まらない | トリガーが送られていない（4-4を確認）／`xdebug.mode`の設定漏れ／再起動し忘れ |
| VSCode側に何も反応がない | SSHトンネルが切れている／ポート番号(9003)がphp.iniとlaunch.jsonで不一致 |
| 止まるが「ソースが見つかりません」と出る、または違うファイルが開く | `pathMappings`の左側パスが実際のサーバー上のパスと違う |
| PHP再起動時にエラーが出る | php.iniの追記部分に構文ミスがある。`php -v`を実行してエラー内容を確認 |
| `php -m`にxdebugが出てこない | `zend_extension`のパスが違う、または編集したphp.iniがWebサーバーの読み込むものと別だった（1章参照） |
