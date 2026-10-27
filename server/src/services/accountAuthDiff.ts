import type {
  AccountAuth,
  AccountAuthInput,
  Authority,
} from "../repositories/accountAuth";
import {
  deriveDesiredState,
  invalidTransitionIssue,
  type EntitlementMarks,
} from "./accountAuthEntitlement";

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

// DIAG用アカウントの状態。none＝DIAG用テーブルに該当行が無い
export type DiagState = "alive" | "deleted" | "none";

// 通常アカウント自体の追加／変更／削除／リストアとは別に生じる、権限とDIAG用アカウントの変化。
// 通常アカウントに変更が無く、これだけが変わる行もある（その場合は added/changed/
// deleted/restored に同じlineが無い）。lineで通常アカウントの行と結びつける
export interface EntitlementChange {
  line: number;
  number: number | null;
  accountName: string;
  // 権限を同期する既存の通常アカウントのid（追加行は未採番のためnull）
  accountId: number | null;
  // 権限の変化（変更なしならnull）。権限は三者択一（null＝なし）
  authority: { before: Authority | null; after: Authority | null } | null;
  // DIAG用アカウントの論理削除・復活（変更なしならnull）。新規追加はしない
  diag: { id: number; before: DiagState; after: DiagState } | null;
}

// 権限・DIAG用の判定に使う追加の入力。省略時は従来どおり通常アカウントだけを比較する
export interface EntitlementContext {
  // recordsと同じ並び・同じ長さ
  marks: EntitlementMarks[];
  // DIAG用アカウントの全件（delfg=1含む）
  currentDiag: AccountAuth[];
  // 通常アカウントのid → 今有効な管理対象の権限（なし＝null）
  currentAuthorities: ReadonlyMap<number, Authority | null>;
}

export interface ImportDiff {
  added: AddedRow[];
  changed: ChangedRow[];
  deleted: DeletedRow[];
  restored: RestoredRow[];
  unchangedCount: number;
  entitlementChanges: EntitlementChange[];
  // 3列の値の不正など、行単位のエラー。validationErrors（1件でもあれば適用全体を拒否）
  // と違い、その行だけを適用対象から外す（通常・DIAG用・権限のどれも一切更新しない。
  // 該当lineは added/changed/deleted/restored/entitlementChanges からも除かれている）
  rowErrors: ValidationError[];
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
  ctx?: EntitlementContext,
): ImportDiff {
  const byAccountName = new Map<string, AccountAuth>();
  const byNumber = new Map<number, AccountAuth>();
  for (const c of current) {
    byAccountName.set(c.accountName, c);
    if (c.number != null) byNumber.set(c.number, c);
  }
  const diagByAccountName = new Map<string, AccountAuth>();
  const diagByNumber = new Map<number, AccountAuth>();
  for (const c of ctx?.currentDiag ?? []) {
    diagByAccountName.set(c.accountName, c);
    if (c.number != null) diagByNumber.set(c.number, c);
  }
  if (ctx && ctx.marks.length !== records.length) {
    throw new Error("marks と records の件数が一致しません");
  }

  const diff: ImportDiff = {
    added: [],
    changed: [],
    deleted: [],
    restored: [],
    unchangedCount: 0,
    entitlementChanges: [],
    rowErrors: [],
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

    // 電子マニュアル／多機能版HTML／DIAGの3列から「あるべき状態」を導く。
    // 値の不正や無効な変更は行ごとエラーにして、その行は一切更新しない
    const ent = ctx ? deriveDesiredState(ctx.marks[i], r.delfg) : null;
    if (ent) {
      // 3列の値そのものの問題があればそれを先に出す（同じ行に重ねて無効な変更の
      // メッセージまで出すと、同じ原因で2件のエラーになり読みづらいため）
      const transition =
        ent.issues.length === 0
          ? invalidTransitionIssue(!!cur && !cur.delfg, ent.desired, r.delfg)
          : null;
      const issues = transition ? [transition] : [...ent.issues];
      if (issues.length > 0) {
        for (const message of issues) {
          diff.rowErrors.push({
            line,
            number: r.number,
            message: `${r.number != null ? `No.${r.number}` : "No.未設定の行"}：${message}`,
          });
        }
        return;
      }
    }

    // 通常アカウントを登録しない状態（電マ×・多機能版HTMLなし。DIAGのみのユーザー）では
    // 通常アカウントを追加・変更・リストアのどれにもしない（解約日ありの削除は別扱い）
    const skipNormal = !!ent && !ent.desired.normalAlive && !r.delfg;

    // 通常アカウント自体の追加／変更／削除／リストア
    let normalChanged = true;
    if (skipNormal) {
      normalChanged = false;
    } else if (!cur) {
      // 新規追加はExcelのcomment列を使わず常に空で始める（備考は運用担当者が
      // アプリ上で手動で書くもので、Excel由来の値を持ち込まない）
      diff.added.push({ line, record: { ...r, comment: null } });
    } else if (r.delfg && !cur.delfg) {
      // 削除／リストアは delfg の遷移で判定。備考に「yyyy/mm/dd 削除」「yyyy/mm/dd 再登録」を自動追記する
      diff.deleted.push({
        line,
        accountName: r.accountName,
        before: cur,
        after: {
          ...r,
          comment: appendComment(cur.comment, `${todayStr()} 削除`),
        },
      });
    } else if (!r.delfg && cur.delfg) {
      diff.restored.push({
        line,
        accountName: r.accountName,
        before: cur,
        after: {
          ...r,
          comment: appendComment(cur.comment, `${todayStr()} 再登録`),
        },
      });
    } else {
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
        normalChanged = false;
      }
    }

    // 権限とDIAG用アカウントの変化
    let entitlementChanged = false;
    if (ent && ctx) {
      const beforeAuthority = cur ? (ctx.currentAuthorities.get(cur.id) ?? null) : null;
      const afterAuthority = ent.desired.authority;
      const authority =
        beforeAuthority !== afterAuthority
          ? { before: beforeAuthority, after: afterAuthority }
          : null;

      // DIAG用は既存行の論理削除・復活だけ（DIAG○なのに行が無くても新規追加しない）
      const curDiag =
        r.number != null
          ? (diagByNumber.get(r.number) ?? diagByAccountName.get(r.accountName))
          : diagByAccountName.get(r.accountName);
      let diag: EntitlementChange["diag"] = null;
      if (curDiag) {
        if (ent.desired.diagAlive && curDiag.delfg) {
          diag = { id: curDiag.id, before: "deleted", after: "alive" };
        } else if (!ent.desired.diagAlive && !curDiag.delfg) {
          diag = { id: curDiag.id, before: "alive", after: "deleted" };
        }
      }

      if (authority || diag) {
        entitlementChanged = true;
        diff.entitlementChanges.push({
          line,
          number: r.number,
          accountName: r.accountName,
          accountId: cur?.id ?? null,
          authority,
          diag,
        });
      }
    }

    if (!normalChanged && !entitlementChanged) diff.unchangedCount++;
  });

  return diff;
}

// 差分プレビューのレスポンスに平文パスワードを含めない（安全ルール）。
// computeImportDiffの戻り値には record/after.password にExcelの生の値が
// そのまま入っているが、これをHTTPレスポンスとして返すと、ハッシュ化される
// 前の平文がブラウザのメモリ・devtools・キャッシュに残ってしまう
// （一覧画面が見せているDB保存済みハッシュとは全く別の、本物の漏洩になる）。
//
// - 追加行：これから設定される初期パスワードなので「値の有無」だけ画面表示
//   に必要（空なら別途validationErrorsで弾かれる）。真の値は固定文字列に
//   置き換えて送る
// - 変更/削除/リストア行：Excelのpassword列は比較（INPUT_FIELDS対象外）・
//   適用（applyAccountAuthImportが明示的に除外）のどちらにも使わないため、
//   値自体を送る必要が無い
//
// 【apply側は無関係】applyはpreviewの結果を信用せず、ファイルを再アップロード
// して自前でcomputeImportDiffを呼び直すため、ここでの加工はハッシュ化や
// DB反映の動作に一切影響しない（渡す先がHTTPレスポンスか、PHPへの書き込み
// 処理かという経路の違いだけ）
const PASSWORD_PRESENT_PLACEHOLDER = "********";

export function redactImportDiffPasswords(diff: ImportDiff): ImportDiff {
  return {
    ...diff,
    added: diff.added.map((a) => ({
      ...a,
      record: {
        ...a.record,
        password: a.record.password ? PASSWORD_PRESENT_PLACEHOLDER : "",
      },
    })),
    changed: diff.changed.map((c) => ({
      ...c,
      after: { ...c.after, password: "" },
    })),
    deleted: diff.deleted.map((d) => ({
      ...d,
      after: { ...d.after, password: "" },
    })),
    restored: diff.restored.map((r) => ({
      ...r,
      after: { ...r.after, password: "" },
    })),
  };
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
  // Excel取り込み専用（手動追加・更新は渡さず、今まで通りrecordの値だけを見る）。
  // 客先管理簿の解約日欄の誤記でdelfgが古いまま(false)残ることがあるため、
  // accountName重複チェックの「削除済みは対象外」判定はDBの現状を優先する。
  // 詳細はdocs/アカウント認証_Excel取り込み設計.md「accountName重複チェックの
  // delfg判定（2026-10-23）」参照
  current: readonly AccountAuth[] = [],
): ValidationError[] {
  const errors: ValidationError[] = [];
  const currentDelfgByNumber = new Map(
    current
      .filter((c): c is AccountAuth & { number: number } => c.number != null)
      .map((c) => [c.number, c.delfg] as const),
  );
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
    // （空き番号扱いという業務ルールのため。No.とは扱いが異なる点に注意）。
    // 「削除済みか」は、DBの現状(currentDelfgByNumber)がtrueならそちらを
    // 優先する（手動パスはcurrent未指定なので常にrの値、挙動は変わらない）
    const isDeleted =
      r.number != null && currentDelfgByNumber.get(r.number) === true
        ? true
        : r.delfg;
    if (isDeleted) return;
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

// apply直前の最終ガード：チェックボックスで選択された内容を実際に書き込んだ
// 結果、生きている(delfg=false)accountNameが新たに重複しないかを確認する。
// validateImportRecordsはファイル全体に対する事前チェックで、applyLinesに
// よる絞り込み後の「この組み合わせで適用した結果」までは見ていないため、
// 書き込み直前に別途この関数でチェックする。詳細は
// docs/アカウント認証_Excel取り込み設計.md「accountName重複チェックの
// delfg判定（2026-10-23）」参照
export function findNewLiveAccountNameDuplicates(
  current: readonly AccountAuth[],
  params: {
    added: AccountAuthInput[];
    changed: { id: number; after: AccountAuthInput }[];
    deleted: { id: number }[];
    restored: { id: number }[];
  },
): string[] {
  const touchedIds = new Set<number>([
    ...params.changed.map((c) => c.id),
    ...params.deleted.map((d) => d.id),
    ...params.restored.map((r) => r.id),
  ]);
  const restoredIds = new Set(params.restored.map((r) => r.id));
  const liveNames: string[] = [];

  for (const c of current) {
    if (touchedIds.has(c.id)) {
      // restoredはdelfgのみtrue→falseになる（accountName等は現状維持のまま
      // 書き込まれる。applyAccountAuthImportのrestored処理と同じ前提）
      if (restoredIds.has(c.id) && c.accountName) liveNames.push(c.accountName);
      continue;
    }
    if (!c.delfg && c.accountName) liveNames.push(c.accountName);
  }
  for (const a of params.added) {
    if (!a.delfg && a.accountName) liveNames.push(a.accountName);
  }
  for (const c of params.changed) {
    if (!c.after.delfg && c.after.accountName) liveNames.push(c.after.accountName);
  }

  const counts = new Map<string, number>();
  for (const n of liveNames) counts.set(n, (counts.get(n) ?? 0) + 1);
  return [...counts.entries()].filter(([, n]) => n >= 2).map(([name]) => name);
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
