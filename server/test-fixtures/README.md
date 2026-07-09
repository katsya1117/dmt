# test-fixtures

自動テストには使わない、手動検証・性能計測用のサンプルファイル置き場。

## account-auth-import-20000rows.xlsx

アカウント認証Excel取り込みの性能計測（2026-07-10）に使用したダミー台帳。20000行、うち40件に解約日を設定（削除判定の確認用）。全行が`user000001`〜`user020000`という新規ユーザーなので、素の状態のDBに読み込ませると全件が「追加」判定になる。

用途：サーバー側パース（`server/src/services/parseAccountAuthExcel.ts`）や差分計算の性能検証・再現確認。

```bash
curl -X POST http://localhost:3001/api/account-auth/import/preview \
  -F "file=@server/test-fixtures/account-auth-import-20000rows.xlsx"
```

詳細な計測結果は `docs/アカウント認証_Excel取り込み設計.md` 参照。
