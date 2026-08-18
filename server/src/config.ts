export const config = {
  port: Number(process.env.PORT) || 3001,

  // Sambaマウントポイント（本番では実際のパスに変更）
  sambaPath: process.env.SAMBA_PATH || '../mock/samba',

  // 顧客PHPサーバーのURL
  phpApiUrl: process.env.PHP_API_URL || 'http://localhost:8080',

  // AMFPHP（レガシー）のJSONプラグイン経由でDbManagerXxx系サービスを呼ぶための設定。
  // 将来AMFPHPを廃止する際は amfphpClient.ts ごと差し替える想定（本設定もそこで不要になる）
  amfphp: {
    // gateway.phpのURL。mock/php-serverは`${phpApiUrl}/webService/amfphp/gateway.php`と
    // 同じパスで動くようにしてある（本番の客先サーバーもこのパスの想定）
    gatewayUrl: process.env.AMFPHP_GATEWAY_URL || `${process.env.PHP_API_URL || 'http://localhost:8080'}/webService/amfphp/gateway.php`,
    // TODO: AuthSession.phpの実体（checkLogin/connectionDbの中身）待ち。
    // 現状は正しい認証方式・target(客先/契約単位?)の意味が未確定のため仮値
    userid: process.env.AMFPHP_USERID || 'TODO',
    key: process.env.AMFPHP_KEY || 'TODO',
    target: process.env.AMFPHP_TARGET || 'TODO',
  },

  // アップロード対象ファイル種別の定義
  resourceTypes: {
    xml:  { label: 'XML（分割済み）', destDir: 'xml' },
    pdf:  { label: 'PDF',            destDir: 'pdf' },
    swf:  { label: 'SWF',            destDir: 'swf' },
    svg:  { label: 'SVG（図版）',     destDir: 'svg' },
    db:   { label: '型式別DB',        destDir: 'db'  },
  } as Record<string, { label: string; destDir: string }>,
}
