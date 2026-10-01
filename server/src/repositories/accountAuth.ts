import { callAmfphpService } from "../services/amfphpClient";
import { hashPassword } from "../utils/hashPassword";

// ─────────────────────────────────────────────────────────────
// データアクセス層（リポジトリ）＝ DB と API の変換境界。
// 客先PHP（AMFPHPのJSONプラグイン経由。詳細はservices/amfphpClient.ts）を
// DbManagerTInetUserAuth.load/updateで呼び出す。関数のシグネチャ（引数・戻り値の型）は
// SQLite版デモの頃と同じに保ってあり、呼び出し側（コントローラー）は無改修。
// - DB表現(tinyint 0/1 ・ 文字列で返る場合あり) ⇄ API表現(boolean) の変換もここで行う。
// - 削除は論理削除（delfg=1）。一覧は全件返し、表示側で区別する。
// - パスワードは平文を保存せずSHA-1ハッシュで保存する（客先仕様、変更不可）。
//   新規追加・Excel取り込みは常に平文が渡ってくる前提で毎回ハッシュ化する。
//   手動更新（updateAccountAuth）だけは「パスワードを変更する」チェックが
//   OFFの場合に空文字が渡ってくる（クライアント側の規約）ため、ここで
//   「空文字ならpasswordキー自体を送らない（＝既存ハッシュを維持）・
//   非空なら新規ハッシュ化」を解決する。
//
// 【部分更新について（2026-10-02）】DbManagerTInetUserAuth.update()は
// 新アプリ専用の新規実装（旧FLEXアプリとは非共有）であり、渡された列だけを
// 更新する本当の部分更新に対応している（詳細はモックPHPのコメント参照）。
// そのため「delfgだけ変えたい」といった更新も、現在の全カラム値を読み直して
// 送り直す必要はなく、変えたい列だけを送ればよい
// ─────────────────────────────────────────────────────────────

const TARGET_TABLE_ID = 0; // t_inet_user_auth（要確認：t_inet_user_auth_ds3ではないか）

// AccountAuth/AccountAuthInput/PhpRow/PhpInfoの4型で名前・型とも共通のフィールド
// （id・accountName⇔username・non_sync・delfg・password以外の全部）をここに集約する
type SharedFields = {
  comment: string | null;
  number: number | null;
  submission_date: string | null;
  regist_date: string | null;
  company_cd: string | null;
  company_name: string | null;
  company_store_cd: string | null;
  company_store_branch_num: string | null;
  store_cd: string | null;
  store_name: string | null;
};

// 読み取り型（レスポンス＝全カラム常に存在。? は使わず null可は `| null`）
export type AccountAuth = SharedFields & {
  id: number;
  accountName: string;
  password: string;
  non_sync: boolean;
  delfg: boolean;
  reg_date: string;
  upd_date: string;
};

// 書き込み型（サーバー管理 id/reg_date/upd_date を除く。読み取りと対称。delfgはユーザーが手動編集するため含む）
export type AccountAuthInput = SharedFields & {
  accountName: string;
  password: string;
  non_sync: boolean;
  delfg: boolean; // 論理削除フラグ。ユーザーが手動編集（PUTで論理削除）。DELETE APIは未開放
};

// AMFPHP(DbManagerTInetUserAuth.load)がSELECTで返す生の行。
// PHP側はカラム名が今もusername（accountNameへのリネームはこのアプリ側のみ）。
// 数値・真偽値はDB実装（MySQL/SQLite）により文字列で返ることがあるため緩く受ける
type PhpRow = SharedFields & {
  id: number | string;
  username: string;
  password: string;
  non_sync: number | string;
  delfg: number | string;
  reg_date: string;
  upd_date: string;
};

function toApi(row: PhpRow): AccountAuth {
  return {
    id: Number(row.id),
    accountName: row.username,
    password: row.password,
    comment: row.comment,
    number: row.number === null ? null : Number(row.number),
    submission_date: row.submission_date,
    regist_date: row.regist_date,
    company_cd: row.company_cd,
    company_name: row.company_name,
    company_store_cd: row.company_store_cd,
    company_store_branch_num: row.company_store_branch_num,
    non_sync: String(row.non_sync) === "1",
    store_cd: row.store_cd,
    store_name: row.store_name,
    reg_date: row.reg_date,
    upd_date: row.upd_date,
    delfg: String(row.delfg) === "1",
  };
}

// AMFPHP(DbManagerTInetUserAuth.update)へ渡す1レコード分（$info相当）。
// updatemark/id以外は本当の部分更新（渡した列だけが更新される）なので
// すべてオプショナル。INSERT時はtoPhpInfo()で全列を埋めて使う
type PhpInfo = Partial<
  SharedFields & {
    username: string;
    password: string;
    non_sync: boolean;
    delfg: boolean;
  }
> & {
  updatemark: "INSERT" | "UPDATE" | "DELETE";
  id?: number;
};

function toPhpInfo(
  input: AccountAuthInput,
  updatemark: PhpInfo["updatemark"],
  id?: number,
): PhpInfo {
  return {
    updatemark,
    id,
    username: input.accountName,
    password: input.password,
    comment: input.comment,
    number: input.number,
    submission_date: input.submission_date,
    regist_date: input.regist_date,
    company_cd: input.company_cd,
    company_name: input.company_name,
    company_store_cd: input.company_store_cd,
    company_store_branch_num: input.company_store_branch_num,
    non_sync: input.non_sync,
    store_cd: input.store_cd,
    store_name: input.store_name,
    delfg: input.delfg,
  };
}

// 論理削除(delfg=1)も含めた全件（削除済み行は「状態」列で区別して表示する）
export async function listAllAccountAuth(): Promise<AccountAuth[]> {
  const rows = await callAmfphpService<PhpRow[]>(
    "DbManagerTInetUserAuth",
    "load",
    [TARGET_TABLE_ID],
  );
  return rows.map(toApi);
}

// listAllAccountAuth()はAMFPHP側の不調で「通信自体は成功したが中身が不完全」な結果を
// 返してくることがある（実運用で確認済み）。No./accountNameの重複チェックやExcel差分計算は
// この一覧を「DBの現在の全件」として信用しきっているため、空配列がそのまま返ると
// 「重複なし」「全部新規」と誤判定してしまう。本番のaccount_authが実質0件になることは
// 想定していないため、空配列は「取得に問題がある」signalとして扱い、検証系の呼び出し元
// （create/update/Excel取り込み）で処理を中断するために使う
export function assertAccountAuthListLooksValid(list: AccountAuth[]): void {
  if (list.length === 0) {
    throw new Error(
      "account_authの取得に失敗しました（取得件数が0件）。時間をおいて再度お試しください。",
    );
  }
}

export async function createAccountAuth(
  records: AccountAuthInput[],
): Promise<{ inserted: number }> {
  const data = records.map((r) =>
    toPhpInfo({ ...r, password: hashPassword(r.password) }, "INSERT"),
  );
  await callAmfphpService("DbManagerTInetUserAuth", "update", [
    TARGET_TABLE_ID,
    data,
  ]);
  return { inserted: records.length };
}

export async function updateAccountAuth(
  id: number,
  input: AccountAuthInput,
): Promise<AccountAuth | null> {
  // 部分更新なので事前に現在行を読む必要はない（idが存在しなければ単に
  // 0件更新で終わり、下のlistAllAccountAuth().find()がnullを返す）
  const info = toPhpInfo(input, "UPDATE", id);
  // 空文字＝「パスワードを変更する」チェックOFF（クライアント側の規約）→
  // passwordキー自体を送らない（部分更新なので既存ハッシュがそのまま維持される）。
  // 非空＝新しい平文が入力された→ハッシュ化して送る（既存ハッシュを再ハッシュしない）
  if (input.password.trim() === "") delete info.password;
  else info.password = hashPassword(input.password);

  await callAmfphpService("DbManagerTInetUserAuth", "update", [
    TARGET_TABLE_ID,
    [info],
  ]);

  const updated = await listAllAccountAuth();
  return updated.find((r) => r.id === id) ?? null;
}

// 論理削除（delfg=1）。現状DELETE APIは未開放（コントローラ側コメント参照）で未使用だが、
// 将来開放する時のために残す。部分更新なのでdelfgだけ送ればよい
export async function deleteAccountAuth(
  id: number,
): Promise<{ deleted: number }> {
  const all = await listAllAccountAuth();
  const current = all.find((r) => r.id === id && !r.delfg);
  if (!current) return { deleted: 0 };

  await callAmfphpService("DbManagerTInetUserAuth", "update", [
    TARGET_TABLE_ID,
    [{ updatemark: "UPDATE", id, delfg: true }],
  ]);
  return { deleted: 1 };
}

// ─────────────────────────────────────────────────────────────
// Excel取り込み適用（apply）専用。
//
// 【idで判定する】以前はaccountName一致でDB行を探していたが、accountName重複の
// レガシーデータ（客先の旧運用による現役データ）が存在するため、accountNameだけ
// では「どの行を更新すべきか」を一意に決められない場合がある。差分計算
// （accountAuthDiff.ts の computeImportDiff）が既にNo.等で正しいDB行を
// 特定し、その id を渡してくる前提にすることで、この曖昧さを無くしている。
// added（新規追加）だけは対応するDB行が無い＝accountNameで新規INSERTでよい
// （accountNameにDB UNIQUE制約は無いが、computeImportDiffの構造上、既存行と
// accountNameが一致する行はaddedではなくchanged/deleted/restoredに分類される
// ため、addedに既存accountNameと衝突するものは混ざらない）。
//
// 【1回のAMFPHP呼び出しにまとめる】DbManagerTInetUserAuth.update()は
// updatemarkの異なる複数レコードを1配列で受け取れるため、add/changed/
// deleted/restoredを1本の配列にまとめて1回のHTTP呼び出しで送る
// （SQLite版のような複数トランザクションの代わり。AMFPHP側が全体をどこまで
// 原子的に扱うかは実装依存で保証はない）。
// ─────────────────────────────────────────────────────────────

export interface ApplyImportParams {
  added: AccountAuthInput[];
  changed: { id: number; after: AccountAuthInput }[];
  deleted: { id: number; comment: string }[];
  restored: { id: number; comment: string }[];
}

export interface ApplyImportResult {
  inserted: number;
  updated: number;
  deleted: number;
  restored: number;
}

export async function applyAccountAuthImport(
  params: ApplyImportParams,
): Promise<ApplyImportResult> {
  // 部分更新なので、deleted/restoredは{id, delfg, comment}だけ、changedは
  // password抜きの残り全列だけを送ればよい（現在行の事前読み込みは不要）

  const data: PhpInfo[] = [];

  for (const a of params.added) {
    data.push(
      toPhpInfo({ ...a, password: hashPassword(a.password) }, "INSERT"),
    );
  }
  for (const c of params.changed) {
    // passwordは意図的に含めない（accountAuthDiff.tsのINPUT_FIELDSからも除外
    // 済み。Excelの初期パスワードで現在のハッシュを上書きしないため、部分更新で
    // キーごと省略し、既存の値をそのまま保持させる）
    const info = toPhpInfo(c.after, "UPDATE", c.id);
    delete info.password;
    data.push(info);
  }
  for (const d of params.deleted) {
    data.push({ updatemark: "UPDATE", id: d.id, delfg: true, comment: d.comment });
  }
  for (const r of params.restored) {
    data.push({ updatemark: "UPDATE", id: r.id, delfg: false, comment: r.comment });
  }

  if (data.length > 0) {
    await callAmfphpService("DbManagerTInetUserAuth", "update", [
      TARGET_TABLE_ID,
      data,
    ]);
  }

  return {
    inserted: params.added.length,
    updated: params.changed.length,
    deleted: params.deleted.length,
    restored: params.restored.length,
  };
}
