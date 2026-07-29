import crypto from 'crypto'

// パスワードは平文を保存せずMD5ハッシュで保存する（客先仕様、変更不可）。
// db.ts（初回シード）とrepositories/accountAuth.ts（実際の書き込み）の両方から
// 使うため、循環参照を避けて独立したユーティリティに切り出している
export function hashPassword(plain: string): string {
  return crypto.createHash('md5').update(plain).digest('hex')
}
