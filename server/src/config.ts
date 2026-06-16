export const config = {
  port: Number(process.env.PORT) || 3001,

  // Sambaマウントポイント（本番では実際のパスに変更）
  sambaPath: process.env.SAMBA_PATH || '../mock/samba',

  // 顧客PHPサーバーのURL
  phpApiUrl: process.env.PHP_API_URL || 'http://localhost:8080',

  // アップロード対象ファイル種別の定義
  resourceTypes: {
    xml:  { label: 'XML（分割済み）', destDir: 'xml' },
    pdf:  { label: 'PDF',            destDir: 'pdf' },
    swf:  { label: 'SWF',            destDir: 'swf' },
    svg:  { label: 'SVG（図版）',     destDir: 'svg' },
    db:   { label: '型式別DB',        destDir: 'db'  },
  } as Record<string, { label: string; destDir: string }>,
}
