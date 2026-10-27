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

// 操作対象のテーブル。通常アカウントとDIAG用アカウントは同じ構造の別テーブルで、
// PHP側は引数ではなく別のサービスクラス（専用メソッド名の方針）で切り替える
export type AccountAuthTarget = "normal" | "diag";

// 権限は三者択一（なし／ALL_MANUAL／HTML_BROWSING）。このツールが扱うのはこの2種類だけで、
// t_authority_manage のほかの権限行には触れない
export type Authority = "ALL_MANUAL" | "HTML_BROWSING";

const PHP_SERVICE: Record<AccountAuthTarget, string> = {
  normal: "DbManagerTInetUserAuth",
  diag: "DbManagerTInetUserAuthDiag",
};

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
  updatemark: "INSERT" | "UPDATE"; // 物理DELETEはサポートしない（論理削除はUPDATE+delfg:trueで表現）
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
export async function listAllAccountAuth(
  target: AccountAuthTarget = "normal",
): Promise<AccountAuth[]> {
  const rows = await callAmfphpService<PhpRow[]>(
    PHP_SERVICE[target],
    "load",
    [],
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
  target: AccountAuthTarget = "normal",
): Promise<{ inserted: number }> {
  const data = records.map((r) =>
    toPhpInfo({ ...r, password: hashPassword(r.password) }, "INSERT"),
  );
  await callAmfphpService(PHP_SERVICE[target], "update", [data]);
  return { inserted: records.length };
}

export async function updateAccountAuth(
  id: number,
  input: AccountAuthInput,
  target: AccountAuthTarget = "normal",
): Promise<AccountAuth | null> {
  // 部分更新なので事前に現在行を読む必要はない（idが存在しなければ単に
  // 0件更新で終わり、下のlistAllAccountAuth().find()がnullを返す）
  const info = toPhpInfo(input, "UPDATE", id);
  // 空文字＝「パスワードを変更する」チェックOFF（クライアント側の規約）→
  // passwordキー自体を送らない（部分更新なので既存ハッシュがそのまま維持される）。
  // 非空＝新しい平文が入力された→ハッシュ化して送る（既存ハッシュを再ハッシュしない）
  if (input.password.trim() === "") delete info.password;
  else info.password = hashPassword(input.password);

  const data = [info];
  await callAmfphpService(PHP_SERVICE[target], "update", [data]);

  const updated = await listAllAccountAuth(target);
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

  const data = [{ updatemark: "UPDATE", id, delfg: true }];
  await callAmfphpService("DbManagerTInetUserAuth", "update", [data]);
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
  // 権限とDIAG用（省略時は通常アカウントだけを書く）
  entitlement?: {
    // addedと同じ並び・同じ長さ。追加した通常アカウントに付ける権限（null＝なし）
    addedAuthorities: (Authority | null)[];
    // 既存の通常アカウント（idで特定）の権限をこの値に揃える。changed/deleted/restoredに
    // 含まれないid（通常アカウント自体は変更が無く権限だけ変わる行）も含む
    authorityById: { id: number; authority: Authority | null }[];
    // DIAG用アカウントの論理削除・復活（新規追加はしない）
    diag: { id: number; delfg: boolean }[];
  };
}

export interface ApplyImportResult {
  inserted: number;
  updated: number;
  deleted: number;
  restored: number;
  // 権限を同期した通常アカウントの件数と、書き込んだDIAG用アカウントの件数
  authoritySynced: number;
  diagWritten: number;
}

// 通常アカウントに付いている管理対象の権限（ALL_MANUAL/HTML_BROWSING）。
// applicate=1のものが「今有効な権限」。三者択一のはずだが、万一両方有効なら
// ALL_MANUALを優先して返す（差分計算がそれを正しい状態に揃え直す）
export async function listManagedAuthorities(): Promise<Map<number, Authority | null>> {
  const rows = await callAmfphpService<
    { account_id: number | string; authority_type: string; applicate: number | string | null }[]
  >("DbManagerAccountAuthImport", "loadAuthorities", []);
  const map = new Map<number, Authority | null>();
  for (const r of rows) {
    const accountId = Number(r.account_id);
    if (!map.has(accountId)) map.set(accountId, null);
    if (String(r.applicate) !== "1") continue;
    const type = r.authority_type as Authority;
    const current = map.get(accountId);
    if (current === "ALL_MANUAL") continue;
    map.set(accountId, type);
  }
  return map;
}

export async function applyAccountAuthImport(
  params: ApplyImportParams,
): Promise<ApplyImportResult> {
  // 部分更新なので、deleted/restoredは{id, delfg, comment}だけ、changedは
  // password抜きの残り全列だけを送ればよい（現在行の事前読み込みは不要）
  type AccountInfo = Omit<PhpInfo, "updatemark"> & {
    updatemark: "INSERT" | "UPDATE" | "NONE"; // NONE＝通常アカウントは更新せず権限だけ同期
    authority?: Authority | null;
  };
  const accounts: AccountInfo[] = [];
  const ent = params.entitlement;
  const authorityOf = new Map(ent?.authorityById.map((a) => [a.id, a.authority]));
  const withAuthority = (info: AccountInfo, id: number): AccountInfo =>
    authorityOf.has(id)
      ? { ...info, authority: authorityOf.get(id) ?? null }
      : info;

  params.added.forEach((a, i) => {
    const info: AccountInfo = toPhpInfo(
      { ...a, password: hashPassword(a.password) },
      "INSERT",
    );
    if (ent) info.authority = ent.addedAuthorities[i] ?? null;
    accounts.push(info);
  });
  for (const c of params.changed) {
    // passwordは意図的に含めない（accountAuthDiff.tsのINPUT_FIELDSからも除外
    // 済み。Excelの初期パスワードで現在のハッシュを上書きしないため、部分更新で
    // キーごと省略し、既存の値をそのまま保持させる）
    const info = toPhpInfo(c.after, "UPDATE", c.id);
    delete info.password;
    accounts.push(withAuthority(info, c.id));
  }
  for (const d of params.deleted) {
    accounts.push(
      withAuthority(
        { updatemark: "UPDATE", id: d.id, delfg: true, comment: d.comment },
        d.id,
      ),
    );
  }
  for (const r of params.restored) {
    accounts.push(
      withAuthority(
        { updatemark: "UPDATE", id: r.id, delfg: false, comment: r.comment },
        r.id,
      ),
    );
  }
  // 通常アカウント自体は変更が無く、権限だけが変わる行
  const written = new Set(
    [...params.changed.map((c) => c.id), ...params.deleted.map((d) => d.id), ...params.restored.map((r) => r.id)],
  );
  for (const a of ent?.authorityById ?? []) {
    if (!written.has(a.id)) accounts.push({ updatemark: "NONE", id: a.id, authority: a.authority });
  }

  if (accounts.length > 0 || (ent?.diag.length ?? 0) > 0) {
    await callAmfphpService("DbManagerAccountAuthImport", "apply", [
      { accounts, diag: ent?.diag ?? [] },
    ]);
  }

  return {
    inserted: params.added.length,
    updated: params.changed.length,
    deleted: params.deleted.length,
    restored: params.restored.length,
    authoritySynced:
      (ent?.authorityById.length ?? 0) +
      (ent?.addedAuthorities.filter((x) => x !== null).length ?? 0),
    diagWritten: ent?.diag.length ?? 0,
  };
}
