import crypto from "crypto";
import { config } from "../config";

// パスワードは平文を保存せずハッシュ化して保存する（客先仕様、変更不可。2026-09-29 客先へ直接確認）。
// アルゴリズムはconfig.passwordHashAlgorithmで切り替え可能（現在はSHA-1、
// 客先の将来的な要望によりSHA-256への切り替えを予定。）
// db.ts（初回シード）とrepositories/accountAuth.ts（実際の書き込み）の両方から
// 使うため、循環参照を避けて独立したユーティリティに切り出している
export function hashPassword(plain: string): string {
  return crypto
    .createHash(config.passwordHashAlgorithm)
    .update(plain)
    .digest("hex");
}
