export const config = {
  port: Number(process.env.PORT) || 3001,

  // Sambaマウントポイント（本番では実際のパスに変更）
  sambaPath: process.env.SAMBA_PATH || "../mock/samba",

  // 顧客PHPサーバーのURL
  phpApiUrl: process.env.PHP_API_URL || "http://localhost:8080",

  // AMFPHP（レガシー）のJSONプラグイン経由でDbManagerXxx系サービスを呼ぶための設定。
  // 将来AMFPHPを廃止する際は amfphpClient.ts ごと差し替える想定（本設定もそこで不要になる）
  amfphp: {
    // gateway.phpのURL。mock/php-serverは`${phpApiUrl}/webService/amfphp/gateway.php`と
    // 同じパスで動くようにしてある（本番の客先サーバーもこのパスの想定）
    gatewayUrl:
      process.env.AMFPHP_GATEWAY_URL ||
      `${process.env.PHP_API_URL || "http://localhost:8080"}/webService/amfphp/gateway.php`,
    // target(0=プライマリ/1=レプリカ)は環境変数化しない。amfphpClient.tsで
    // プライマリ固定にしている（理由は同ファイルのコメント参照）
    // userid/key: t_mng_admin.id / certificationkey と照合される（checkLogin参照）。
    // 実際にExpress用にどの値を発行してもらうかはまだ未確定のためTODOのまま
    userid: process.env.AMFPHP_USERID || "TODO",
    key: process.env.AMFPHP_KEY || "TODO",
  },

  // パスワードの新規ハッシュ化に使うアルゴリズム。客先の要望でSHA-1→SHA-256へ
  // 将来切り替える想定（環境変数で即座に切替可能にしておく）。切り替えても
  // 既存DBのSHA-1ハッシュ値は書き換わらない（このアプリは書き込み専用で、
  // ログイン照合は別システムが担当。切り替えのタイミングはそちら側の
  // SHA-256対応完了を確認してから）
  passwordHashAlgorithm: process.env.PASSWORD_HASH_ALGO || "sha1",

  // アップロード対象ファイル種別の定義
  resourceTypes: {
    xml: { label: "XML（分割済み）", destDir: "xml" },
    pdf: { label: "PDF", destDir: "pdf" },
    swf: { label: "SWF", destDir: "swf" },
    svg: { label: "SVG（図版）", destDir: "svg" },
    db: { label: "型式別DB", destDir: "db" },
  } as Record<string, { label: string; destDir: string }>,
};
