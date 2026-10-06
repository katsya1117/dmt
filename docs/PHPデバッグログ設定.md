# PHPデバッグログ設定（AlmaLinux10 + Apache）

（作成: 2026-10-07）

開発中にPHPのエラーをしっかりログに出したい時のセットアップ手順と、関連するログの役割分担のメモ。

## 設定手順

### 1. 実際に読まれているphp.iniを確認する

CLIの`php --ini`と、Apache（Webから動く方）が読むiniは**別の場合がある**。確実なのは、Webからアクセスできる場所に確認用ファイルを置いて見ること。

```php
<?php phpinfo();
```

ブラウザで開き、「Loaded Configuration File」の行を見る（これが本当に有効なphp.ini）。

### 2. php.iniで以下を設定する

```ini
display_errors = On
display_startup_errors = On
error_reporting = E_ALL
log_errors = On
error_log = /var/log/php_errors.log
```

`error_log`が空だと、PHPはApacheモジュール（mod_php）の場合「Apache自身のエラーログ」に流れる。「専用のログファイルに出したいのに全然出ない」の一番よくある原因がこれ。

### 3. php-fpmを使っている場合は要注意（AlmaLinuxでは多い構成）

AlmaLinux10だと、Apache+PHPは`mod_php`ではなく**php-fpm**（`mod_proxy_fcgi`経由）という構成が標準的。この場合、プールの設定ファイル（`/etc/php-fpm.d/www.conf`）が**php.iniの設定を上書き**することがある。

```ini
; www.conf 内
php_admin_value[error_log] = /var/log/php-fpm/error.log
php_admin_flag[log_errors] = on
catch_workers_output = yes
```

どちらを使っているか確認：
```bash
systemctl status php-fpm
apachectl -M | grep -i php
```

### 4. ログファイルの権限とSELinux（一番ハマりやすい）

- ファイル・ディレクトリがApacheの実行ユーザー（通常`apache`）から書き込めるか
- **SELinuxがEnforcingだと、独自パスに置いたログファイルへの書き込みが権限エラーも出さずに黙って弾かれる**（AlmaLinuxはデフォルトEnforcing）

一番簡単な回避策は、**最初からSELinuxが許可済みの標準ディレクトリ**（`/var/log/httpd/`や`/var/log/php-fpm/`配下）にログを置くこと。独自パスにしたい場合：

```bash
touch /var/log/php_errors.log
chown apache:apache /var/log/php_errors.log
semanage fcontext -a -t httpd_log_t "/var/log/php_errors.log"
restorecon -v /var/log/php_errors.log
```

### 5. 設定変更後は必ず再起動

```bash
systemctl restart httpd
systemctl restart php-fpm   # 使っている場合
```

iniを編集しただけでは反映されない。

### 6. 確認

```bash
tail -f /var/log/php_errors.log
```

を実行したまま、エラーが起きる操作を再現する。

## 3つのログの役割分担

| ログ | 主な役割 | PHPのアプリエラーは自然に出る？ |
|---|---|---|
| **httpd**（`/var/log/httpd/error_log`） | Apache（Webサーバー本体）のログ。モジュール読み込み・Apacheレベルの500番台エラー・**php.iniの`error_log`が未設定の場合のPHPエラーの受け皿（フォールバック先）** | △（設定が無い時だけここに流れ着く） |
| **php-fpm**（`/var/log/php-fpm/error.log`等） | FPM（PHPを実行するワーカープロセス群）自体の管理ログ（起動・ワーカー異常終了・リクエスト詰まり等）。アプリのPHPエラーは、プール設定(`www.conf`)で`error_log`を明示的にここへ向けていない限り基本流れない | △（プール設定次第） |
| **自分で指定した`error_log`**（例：`/var/log/php_errors.log`） | PHPのアプリケーションレベルのエラー（warning/notice/fatal/未捕捉の例外）が、設定通りに動いていれば自然に出る本来の受け皿 | ◎（これが本来の行き先） |

「エラーの詳細がどこに自然に出力されるか」は決まった1箇所ではなく、**php.ini（+php-fpmのプール設定があればそちらが優先）の`error_log`がどこを指しているか**で決まる。意図通り設定できていれば指定したファイルに出るが、設定が効いていない（読み込まれているiniが違う、プール設定で上書きされている等）場合はhttpdやphp-fpmの既定ログに流れてしまい、「設定したはずのファイルに出ない」という状態になる。

## 自分で書いたログ処理の行き先

- PHP組み込みの**`error_log($message)`関数**を、送り先を指定せずに呼んだ場合 → 上記と同じ`error_log` ini設定に従う（＝設定した自分のログファイルに入る）
- 自分で`fwrite`や`file_put_contents`で**直接パスを指定して**書いている場合 → ini設定とは無関係に、指定したパスにそのまま書かれる（iniの迷路に関係なく確実に出るので、デバッグ中はこちらの方が追跡しやすいこともある）
- Monologなどのロギングライブラリを使っている場合 → そのライブラリの設定（どのファイルに書くか）次第で、PHPのini設定とは独立している

## 補足：VS Codeの「ターミナル」「デバッグコンソール」とブラウザDevToolsは別物

- **VS Codeのターミナルパネル**：ただのシェル。そこで実行したコマンドの標準出力・標準エラーがそのまま出る（`tail -f /var/log/php_errors.log`等）
- **VS Codeのデバッグコンソール**：デバッガーをアタッチして実行中だけ出るパネル。ブレークポイントで止まっている間、変数の値をその場で評価・確認できるのが特徴（簡易REPL）。プログラムの出力の表示先にもなりうるが、本来は「変数を覗く」ためのもの
- **ブラウザのDevToolsコンソール**：VS Codeと無関係。クライアント側（ブラウザで動くJS）のエラー・`console.log`だけが出る。サーバー側（PHP）のエラーはここには出ない

Apache/php-fpmはVS Codeから起動したプロセスではなく、OS側で裏で動いているサービスのため、ターミナルで`tail -f`していない限りVS Codeのどのパネルにも自動では出てこない。確実に見るには、実際のログファイルの場所を特定してターミナルで`tail -f`するのが一番素直。

## `.vscode/launch.json`の`console`設定（Node.js系のデバッグ設定）

このリポジトリの`.vscode/launch.json`（Express/tsxのデバッグ構成）では`"console": "integratedTerminal"`を設定済み。これが推奨設定。

| 設定値 | 動作 |
|---|---|
| `internalConsole`（デフォルト） | プログラムの出力が**デバッグコンソール**パネルに出る |
| `integratedTerminal`（推奨） | プログラムの出力が**ターミナル**パネルの新しいタブに出る |
| `externalTerminal` | VS Codeの外に、OS標準のターミナルウィンドウが別途開いて出る |

**`integratedTerminal`を推奨する理由**：
- ターミナルとして正しく振る舞う（色・ANSI・プログラムからの入力待ち等がきちんと動く）。`internalConsole`はこの辺りの再現が不完全な場合がある
- 普段使っているターミナルと同じ見た目・操作感になるので、ログが見づらい等の問題が起きにくい

デメリットは、ブレークポイントで止まった時に変数を覗く「デバッグコンソール」と、プログラムの出力（ターミナル）が別パネルに分かれること。両方同時に見たい時はタブ切り替えが必要だが、出力の見やすさの方が実務上重要なので`integratedTerminal`の方が無難。

## Xdebugでブレークポイントで止めても変数が未定義になる問題

パスマッピング経由でブレークポイントを設定し、止まった時に「もう通っているはずの行なのに変数が未定義」となる場合、原因は主に3パターン。

### 1. 「ブレークポイントの行は、まだ実行されていない」（一番多い誤解）

デバッガーは「その行に到達したら止まる」のではなく、**「その行を実行する直前で止まる」**という挙動。ブレークポイントを置いた行自体で変数に値を代入している場合（`$x = foo();`のような行）、止まった瞬間はまだその代入が**実行されていない**ので`$x`は未定義のままになる。

```php
$x = foo();  // ← ここにブレークポイント。止まった時点ではまだ実行前。$xは未定義
echo $x;
```

1行ステップオーバー（F10）して進めると、代入が実行されて`$x`が見えるようになる。これはXdebug特有ではなく、どのデバッガーでも同じ挙動。

### 2. パスマッピングのズレで「違うファイルの同じ行」を見ている

`pathMappings`（ローカルのファイルパス↔リモート/コンテナ側のパスの対応）が微妙にズレていると、VS Code側のエディタで見えている行と、Xdebugが実際に止まっている実行位置が**ズレて表示される**ことがある。見た目は「もう通っているはずの行」でも、実行は実はもう少し前の別の行（別バージョンのファイル）だった、ということがある。

### 3. OPcacheが古いコンパイル結果を使っている

`opcache.enable=1`のまま開発していると、ファイルを編集した後もPHPが**古いコンパイル済みコード**を実行し続け、エディタ上のソースと実際の実行内容がズレることがある。開発中は

```ini
opcache.enable=0
```
または
```ini
opcache.validate_timestamps=1
opcache.revalidate_freq=0
```
にしておくのが定番の対処。
