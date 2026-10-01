import type {
  AccountAuth,
  AccountAuthInput,
} from "../repositories/accountAuth";

// ─────────────────────────────────────────────────────────────
// Excel取り込みの差分計算（純粋関数・書き込みなし）。
// 「ファイルにある行だけ」判定する。ファイルに無い＝削除にはしない（安全）。
// 現状(current)は delfg=1 も含めた全件を渡すこと（リストア判定のため）。
// ─────────────────────────────────────────────────────────────

// line = Excelファイル内の行番号（1始まり）。プレビュー画面で検証エラーの
// 行を該当レコードにハイライトするために持たせている
export interface AddedRow {
  line: number;
  record: AccountAuthInput;
}

export interface ChangedRow {
  line: number;
  accountName: string;
  before: AccountAuth;
  after: AccountAuthInput;
  changedFields: string[];
}

export interface DeletedRow {
  line: number;
  accountName: string;
  before: AccountAuth; // 適用時にidで対象行を特定するため保持
  after: AccountAuthInput;
}

export interface RestoredRow {
  line: number;
  accountName: string;
  before: AccountAuth;
  after: AccountAuthInput;
}

export interface ValidationError {
  line: number;
  number: number | null;
  message: string;
}

export interface ImportDiff {
  added: AddedRow[];
  changed: ChangedRow[];
  deleted: DeletedRow[];
  restored: RestoredRow[];
  unchangedCount: number;
  // ファイル内重複などの検証エラー（validateImportRecordsと同じ内容）。
  // プレビュー時点で気づけるように、差分計算自体は止めずここに載せて返す。
  // lineを持たせているのは、プレビュー画面で該当行をハイライトするため
  validationErrors: ValidationError[];
}

// AccountAuthInput の項目名（比較対象）。【commentは含めない】備考欄はExcelから
// 来るものではなく運用担当者がアプリ上で手動編集するものなので、Excel側の値と
// 差分検知・上書きの対象にしない（下記の自動追記コメント生成でのみcommentを触る）
const INPUT_FIELDS: (keyof AccountAuthInput)[] = [
  "accountName",
  "number",
  "submission_date",
  "regist_date",
  "company_cd",
  "company_name",
  "company_store_cd",
  "company_store_branch_num",
  "non_sync",
  "store_cd",
  "store_name",
  "delfg",
];

// 認証に関わる（事故ると客がログインできなくなる）項目。UIで強調する
export const AUTH_CRITICAL_FIELDS = ["accountName", "delfg"];

// 変更内容を表す項目名（運用担当者が普段手入力している備考の文言に合わせる）
export const FIELD_LABELS: Partial<Record<keyof AccountAuthInput, string>> = {
  accountName: "ユーザー名",
  number: "No.",
  submission_date: "申込日",
  regist_date: "登録日",
  company_cd: "販社CD",
  company_name: "販売会社",
  company_store_cd: "販売会社店舗CD",
  company_store_branch_num: "店舗CD枝番",
  non_sync: "診断データ対象外",
  store_cd: "販売店CD",
  store_name: "販売店名",
};

// 比較前値置換ルール（docs/Excel取り込み_比較前値置換ルール.md参照）の対象にできる列。
// 文字列型の列のみに限定する（number/non_sync/delfgは型変換が要る上、表記ゆれの
// 吸収というユースケースにも合わないため対象外。YAGNI）
export const NORMALIZABLE_FIELDS: (keyof AccountAuthInput)[] = [
  "accountName",
  "submission_date",
  "regist_date",
  "company_cd",
  "company_name",
  "company_store_cd",
  "company_store_branch_num",
  "store_cd",
  "store_name",
];

// fieldはAMFPHP(_properties)由来の生データで型保証が無いため、呼び出し側に
// keyof AccountAuthInputでの検証を強制しない（この関数自身がNORMALIZABLE_FIELDS
// で安全に絞り込む）
export type ValueNormalizeRule = {
  field: string;
  fromValue: string;
  toValue: string;
};

// Excelパース直後・差分計算の前に、ルールに一致する値を正規化する。
// 【なぜ比較後ではなくここで置き換えるか】差分検出だけを抑制すると、after
// オブジェクトに生のExcel値が残ったままになり、同じ行の別列が本当に変更されて
// apply された時、意図せずDBの値を上書きしてしまう（docs/Excel取り込み_
// 比較前値置換ルール.md参照）。ここで値自体を書き換えることで、検出・表示・
// 実際の書き込みのすべてで一貫した値が使われる
export function applyValueNormalizeRules(
  records: AccountAuthInput[],
  rules: ValueNormalizeRule[],
): AccountAuthInput[] {
  if (rules.length === 0) return records;
  const applicableRules = rules.filter(
    (r): r is ValueNormalizeRule & { field: keyof AccountAuthInput } =>
      NORMALIZABLE_FIELDS.some((f) => f === r.field),
  );
  if (applicableRules.length === 0) return records;

  return records.map((r) => {
    let next = r;
    for (const rule of applicableRules) {
      if (next[rule.field] === rule.fromValue) {
        next = { ...next, [rule.field]: rule.toValue };
      }
    }
    return next;
  });
}

function todayStr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

function formatValue(v: string | number | boolean | null): string {
  if (v === null || v === "") return "（空）";
  if (typeof v === "boolean") return v ? "ON" : "OFF";
  return String(v);
}

// 変更内容から「yyyy/mm/dd 項目名変更 旧値→新値、項目名変更 旧値→新値」を生成する。
function buildChangeComment(
  changedFields: (keyof AccountAuthInput)[],
  before: AccountAuth,
  after: AccountAuthInput,
): string | null {
  const parts = changedFields.map(
    (f) =>
      `${FIELD_LABELS[f] ?? f}変更 ${formatValue(before[f])}→${formatValue(after[f])}`,
  );
  if (parts.length === 0) return null;
  return `${todayStr()} ${parts.join("、")}`;
}

// 既存の備考の後ろにスペース区切りで追記する（上書きしない）
function appendComment(existing: string | null, addition: string): string {
  return existing && existing.trim() !== ""
    ? `${existing} ${addition}`
    : addition;
}

export function computeImportDiff(
  records: AccountAuthInput[],
  current: AccountAuth[],
): ImportDiff {
  const byAccountName = new Map<string, AccountAuth>();
  const byNumber = new Map<number, AccountAuth>();
  for (const c of current) {
    byAccountName.set(c.accountName, c);
    if (c.number != null) byNumber.set(c.number, c);
  }

  const diff: ImportDiff = {
    added: [],
    changed: [],
    deleted: [],
    restored: [],
    unchangedCount: 0,
    validationErrors: [],
  };

  records.forEach((r, i) => {
    const line = i + 1;
    // 【No.を優先して照合する】accountNameは削除後に別レコードで再利用できる
    // 仕様のため、DBに同じaccountNameの行が複数存在しうる（例：dealer099を削除
    // →別レコードで再びdealer099を使う）。accountNameだけで照合すると
    // byAccountNameが後勝ちで上書きされ、間違った方のDB行にマッチしてしまう
    // （実例：削除済みのはずの行が、生きている別レコードにマッチしてしまい
    // 誤って「削除」の差分として検出される）。No.は削除済み含む全レコードで
    // 一意という前提があるため、No.があればそちらを優先する
    // （2026-08-06、運用データでの不具合報告により修正）
    const cur =
      r.number != null
        ? (byNumber.get(r.number) ?? byAccountName.get(r.accountName))
        : byAccountName.get(r.accountName);

    if (!cur) {
      // 新規追加はExcelのcomment列を使わず常に空で始める（備考は運用担当者が
      // アプリ上で手動で書くもので、Excel由来の値を持ち込まない）
      diff.added.push({ line, record: { ...r, comment: null } });
      return;
    }
    // 削除／リストアは delfg の遷移で判定。備考に「yyyy/mm/dd 削除」「yyyy/mm/dd 再登録」を自動追記する
    if (r.delfg && !cur.delfg) {
      diff.deleted.push({
        line,
        accountName: r.accountName,
        before: cur,
        after: {
          ...r,
          comment: appendComment(cur.comment, `${todayStr()} 削除`),
        },
      });
      return;
    }
    if (!r.delfg && cur.delfg) {
      diff.restored.push({
        line,
        accountName: r.accountName,
        before: cur,
        after: {
          ...r,
          comment: appendComment(cur.comment, `${todayStr()} 再登録`),
        },
      });
      return;
    }
    // passwordはINPUT_FIELDSから除外済み。管理簿には初期パスワードしか載らずDBとの差異が常態なので比較対象外
    const changedFields = INPUT_FIELDS.filter((f) => {
      return r[f] !== cur[f];
    });
    if (changedFields.length > 0) {
      const changeText = buildChangeComment(changedFields, cur, r);
      const after: AccountAuthInput = {
        ...r,
        comment: changeText
          ? appendComment(cur.comment, changeText)
          : cur.comment,
      };
      diff.changed.push({
        line,
        accountName: r.accountName,
        before: cur,
        after,
        changedFields,
      });
    } else {
      diff.unchangedCount++;
    }
  });

  return diff;
}

// 適用前検証：壊れた行・ファイル内重複・必須欠けを弾く（安全ルール#5）
// accountNameにDB UNIQUE制約は無い（客先の旧運用で重複accountNameが現役で存在する
// ため）ので、この関数がaccountName重複を拒否する唯一の層。No.も同様にDB制約が
// 無いため、拒否できるのはこの関数だけ
//
// 【No.とaccountNameで一意性チェックの範囲が異なる】
// - No.は「全レコード」（削除済み含む）で一意性を見る。一度使われたNo.を
//   削除後に別レコードへ再割り当てすると紛らわしいため、delfg=trueの行でも
//   チェック対象・記録対象にする（2026-07-31、ユーザー指摘で変更）
// - accountNameは「生きている行（delfg=false）同士」でのみチェックする。客先の
//   運用要望：削除フラグを立てたレコードのaccountNameは「空き」として扱い、別
//   レコードで再割り当てしたい。よってdelfg=trueの行はaccountName重複チェック
//   の対象外（他の行のaccountNameとぶつかっていても無視する）。ただし、リストア
//   （delfg: true→false）によって「生きている行」同士が重複する場合は通常の
//   新規追加と同じ扱いで拒否する（呼び出し側は該当行をrecordsに含めて渡すことで
//   自然にこのチェックにかかる。特別扱いの分岐は用意しない）
//
// 【手動追加・手動更新（リストア含む）でも同じ関数を使う】Excel取り込みは
// 再アップロードされた全件を records に渡すため既存No./accountNameも自然に
// 含まれるが、手動追加・更新は対象の1行だけしか持たない。
// existingNumbers（全レコード）/existingAccountNames（自分以外の生きている
// レコード）を渡すことで、手動操作からの呼び出しでも「既存データとの重複」
// を同じロジックで検知できる（Excel取り込みとバリデーションが分岐しないようにするため）
export function validateImportRecords(
  records: AccountAuthInput[],
  existingNumbers: ReadonlySet<number> = new Set(),
  existingAccountNames: ReadonlySet<string> = new Set(),
): ValidationError[] {
  const errors: ValidationError[] = [];
  // 【No.・accountNameで相手の行を記録する】ユーザーは取り込みファイルの
  // 「何行目」かではなく、業務で使うNo.（管理番号）で行を識別する。
  // 「N行目」という表示はユーザーにとって何の目印にもならない上、パース時に
  // 欠番注記行が除かれるためExcel上の実際の行位置とも一致しない（そもそも
  // 無意味な情報）。そこで重複の相手を示す際は、No.重複ならaccountNameで、
  // accountName重複ならNo.で、それぞれ相手を識別する
  const firstAccountNameForNumber = new Map<number, string>();
  const firstNumberLabelForAccountName = new Map<string, string>();
  for (const n of existingNumbers)
    firstAccountNameForNumber.set(n, "既存データ");
  for (const u of existingAccountNames)
    firstNumberLabelForAccountName.set(u, "既存データ");
  const numberLabel = (n: number | null) =>
    n != null ? `No.${n}` : "No.未設定の行";
  records.forEach((r, i) => {
    const line = i + 1;
    // No.は必須（未設定を許すとユーザーが行を識別する手段がなくなるため）
    if (r.number == null)
      errors.push({
        line,
        number: r.number,
        message: "No.が設定されていません",
      });
    if (!r.accountName)
      errors.push({
        line,
        number: r.number,
        message: `${numberLabel(r.number)}：accountNameが空です`,
      });
    if (!r.password)
      errors.push({
        line,
        number: r.number,
        message: `${numberLabel(r.number)}：passwordが空です`,
      });
    // No.は削除済み行も含めて常にチェックする（過去に使われたNo.の再利用を防ぐ）
    if (r.number != null) {
      const firstAccountName = firstAccountNameForNumber.get(r.number);
      if (firstAccountName != null) {
        errors.push({
          line,
          number: r.number,
          message: `No.${r.number}が重複しています（同じNo.の行: ${firstAccountName}）`,
        });
      } else {
        firstAccountNameForNumber.set(
          r.number,
          r.accountName || "（accountName未設定）",
        );
      }
    }
    // accountName重複チェックだけは削除済み行（delfg=true）を対象外にする
    // （空き番号扱いという業務ルールのため。No.とは扱いが異なる点に注意）
    if (r.delfg) return;
    if (r.accountName) {
      const first = firstNumberLabelForAccountName.get(r.accountName);
      if (first != null) {
        errors.push({
          line,
          number: r.number,
          message: `accountNameが重複しています（${first}と重複、新規の重複登録は許可されません）: ${r.accountName}`,
        });
      } else {
        firstNumberLabelForAccountName.set(
          r.accountName,
          numberLabel(r.number),
        );
      }
    }
  });
  return errors;
}

// 手動追加・更新は常に1件だけの検証なので、対象は常に自分自身であり
// 「No.X：」という前置きは自明で冗長（フォーム上にNo.欄が見えている）。
// 手動操作の呼び出し元だけ、メッセージ先頭のこの前置きを取り除いて表示する。
// 【なぜこの1箇所を消すだけで済むか】手動呼び出しはrecordsが常に1件で、
// existingNumbers/existingAccountNamesは常に「既存データ」ラベルとして渡って
// くるため、メッセージ本文中に他のNo.が登場することはない（先頭の
// 「No.X：」を除けばNo.への言及自体が無い）
export function formatManualValidationMessage(error: ValidationError): string {
  return error.message.replace(/^No\.(\d+|未設定の行)：/, "");
}
