// ─────────────────────────────────────────────────────────────
// 管理簿の3列（電子マニュアル／多機能版HTML／DIAG）と解約日から、アカウントの
// 「あるべき状態」（通常アカウントを生かすか・DIAG用を生かすか・付与する権限）を
// 導出する純粋関数。書き込みは一切しない。
//
// 3列は account_auth のDB列ではなく、DBの権限行とDIAG用の行から導出した状態と比べる
// （差分計算側の責務）。ここでは「Excelの値 → あるべき状態」だけを決める。
// ルールの出典：メモリ project-diag-and-authority-rules（2026-10-27ユーザー明文化）。
// ─────────────────────────────────────────────────────────────

// on=○ / off=× / blank=入力なし / invalid=○×空のどれでもない記号
export type Mark = "on" | "off" | "blank" | "invalid";

// 付与する権限は三者択一（なし／ALL_MANUAL／HTML_BROWSING）。同時に2つは付かない
export type Authority = "ALL_MANUAL" | "HTML_BROWSING";

export type EntitlementColumn = "manual" | "html" | "diag";

export const ENTITLEMENT_COLUMN_LABELS: Record<EntitlementColumn, string> = {
  manual: "電子マニュアル",
  html: "多機能版HTML",
  diag: "DIAG",
};

// 表記ゆれは記号の○／×に寄せる。漢数字の〇（U+3007）は記号の○として扱う
// （客先の入力ゆれ。ユーザー指示 2026-10-26）。それ以外は invalid
const ON_MARKS = new Set(["○", "◯", "〇", "⚪", "⭕"]);
const OFF_MARKS = new Set(["×", "✕", "✖", "✗", "x", "X"]);

export function normalizeMark(raw: string | null | undefined): Mark {
  // NFKC：全角英字（Ｘ→X）などの幅ゆれを吸収する。○類・×類は互換分解されない
  const s = (raw ?? "").normalize("NFKC").trim();
  if (s === "") return "blank";
  if (ON_MARKS.has(s)) return "on";
  if (OFF_MARKS.has(s)) return "off";
  return "invalid";
}

export interface EntitlementMarks {
  manual: Mark;
  html: Mark;
  diag: Mark;
}

export interface DesiredState {
  normalAlive: boolean;
  diagAlive: boolean;
  authority: Authority | null;
}

export interface EntitlementResult {
  desired: DesiredState;
  // 1つでもあれば、その行はエラーとして適用対象から外す（一切更新しない）
  issues: string[];
}

// cancelled=管理簿に解約日が入っている行（delfg=true）。通常・DIAG用とも論理削除し、
// 権限も外す（applicate=0）
export function deriveDesiredState(
  marks: EntitlementMarks,
  cancelled: boolean,
): EntitlementResult {
  const issues: string[] = [];

  // 無効な記号は「入力なし」として扱い、あったこと自体をエラーにする
  const effective: EntitlementMarks = { ...marks };
  for (const col of ["manual", "html", "diag"] as const) {
    if (marks[col] === "invalid") {
      effective[col] = "blank";
      issues.push(
        `${ENTITLEMENT_COLUMN_LABELS[col]}列に無効な記号があります（○・×・入力なしのみ有効）`,
      );
    }
  }

  if (cancelled) {
    return {
      desired: { normalAlive: false, diagAlive: false, authority: null },
      issues,
    };
  }

  // 電子マニュアル列は「×」以外（○・入力なし）を同じ扱いにする
  const manualOff = effective.manual === "off";
  const htmlOn = effective.html === "on";
  const diagOn = effective.diag === "on";

  let normalAlive: boolean;
  let authority: Authority | null = null;
  if (!manualOff) {
    normalAlive = true;
    authority = htmlOn ? "ALL_MANUAL" : null;
  } else if (htmlOn) {
    // 電マ×かつ多機能版HTML○：DIAGの値に関わらず通常に登録し HTML_BROWSING を付与
    normalAlive = true;
    authority = "HTML_BROWSING";
  } else {
    normalAlive = false;
  }

  if (manualOff && !htmlOn && !diagOn) {
    issues.push(
      "どこにも登録されない組み合わせです（電子マニュアル×・多機能版HTMLなし・DIAGなし）",
    );
  }

  return { desired: { normalAlive, diagAlive: diagOn, authority }, issues };
}

// 既存の生きている通常アカウントが、解約日なしで「電マ×・多機能版HTMLなし」になる
// 変更は無効な状態（通常アカウントが論理削除されるのは解約日が入ったときだけ）。
// 毎回エラーにして、その行は一切更新しない。通常が無い／削除済みのままなら正常
// （DIAGのみのユーザー）なのでエラーにしない
export function invalidTransitionIssue(
  normalCurrentlyAlive: boolean,
  desired: DesiredState,
  cancelled: boolean,
): string | null {
  if (cancelled || !normalCurrentlyAlive || desired.normalAlive) return null;
  return "生きている通常アカウントが「電子マニュアル×・多機能版HTMLなし」になる変更は無効です（解約日が無い限り通常アカウントは削除されません）";
}
