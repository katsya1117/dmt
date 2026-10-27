import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeMark,
  deriveDesiredState,
  invalidTransitionIssue,
  type Mark,
} from "./accountAuthEntitlement";

test("normalizeMark: ○の表記ゆれ（漢数字の〇・⚪・◯）は on", () => {
  for (const s of ["○", "〇", "◯", "⚪", " ○ "]) assert.equal(normalizeMark(s), "on", s);
});

test("normalizeMark: ×の表記ゆれは off、空は blank、それ以外は invalid", () => {
  for (const s of ["×", "x", "X", "Ｘ", "✕"]) assert.equal(normalizeMark(s), "off", s);
  for (const s of ["", "  ", null, undefined]) assert.equal(normalizeMark(s), "blank");
  for (const s of ["△", "-", "1", "あり"]) assert.equal(normalizeMark(s), "invalid", s);
});

// 全パターン表（解約日なし）。manual は ○/空 を同じ扱いにするので on・blank 両方で確認する
const m = (manual: Mark, html: Mark, diag: Mark) => ({ manual, html, diag });
const cases: [string, Mark, Mark, Mark, boolean, boolean, string | null, boolean][] = [
  // 名前, 電マ, HTML, DIAG, 通常, DIAG用, 権限, エラー有無
  ["#1 ○/○/○", "on", "on", "on", true, true, "ALL_MANUAL", false],
  ["#2 ○/○/−", "on", "on", "blank", true, false, "ALL_MANUAL", false],
  ["#3 ○/−/○", "on", "blank", "on", true, true, null, false],
  ["#4 ○/−/−", "on", "blank", "blank", true, false, null, false],
  ["#1' 空/○/○（空は○扱い）", "blank", "on", "on", true, true, "ALL_MANUAL", false],
  ["#4' 空/×/−（HTML×は−扱い）", "blank", "off", "blank", true, false, null, false],
  ["#5 ×/○/○（DIAGのみにHTML版を見せる）", "off", "on", "on", true, true, "HTML_BROWSING", false],
  ["#6 ×/○/−", "off", "on", "blank", true, false, "HTML_BROWSING", false],
  ["#7 ×/−/○（DIAGのみ）", "off", "blank", "on", false, true, null, false],
  ["#8 ×/−/−（どこにも登録されない）", "off", "blank", "blank", false, false, null, true],
];
for (const [name, manual, html, diag, normal, diagAlive, authority, hasIssue] of cases) {
  test(`deriveDesiredState: ${name}`, () => {
    const r = deriveDesiredState(m(manual, html, diag), false);
    assert.deepEqual(r.desired, { normalAlive: normal, diagAlive, authority });
    assert.equal(r.issues.length > 0, hasIssue);
  });
}

test("deriveDesiredState: 解約日あり→通常・DIAG用とも論理削除、権限なし、#8でもエラーにしない", () => {
  for (const marks of [m("on", "on", "on"), m("off", "blank", "blank")]) {
    const r = deriveDesiredState(marks, true);
    assert.deepEqual(r.desired, { normalAlive: false, diagAlive: false, authority: null });
    assert.deepEqual(r.issues, []);
  }
});

test("deriveDesiredState: 無効な記号は入力なし扱い＋エラー（電マが無効→空＝○扱いでも適用対象から外れる）", () => {
  const r = deriveDesiredState(m("invalid", "on", "blank"), false);
  assert.equal(r.desired.normalAlive, true);
  assert.equal(r.desired.authority, "ALL_MANUAL");
  assert.equal(r.issues.length, 1);
  assert.match(r.issues[0], /電子マニュアル列に無効な記号/);

  const r2 = deriveDesiredState(m("on", "invalid", "invalid"), false);
  assert.equal(r2.issues.length, 2);
  assert.equal(r2.desired.authority, null);
});

test("invalidTransitionIssue: 生きている通常が電マ×・HTMLなしになる変更はエラー", () => {
  const desired = deriveDesiredState(m("off", "blank", "on"), false).desired;
  assert.ok(invalidTransitionIssue(true, desired, false));
  // 通常が無い／削除済みのままなら正常（DIAGのみのユーザー）
  assert.equal(invalidTransitionIssue(false, desired, false), null);
  // 解約日ありは通常の削除フロー
  assert.equal(invalidTransitionIssue(true, desired, true), null);
  // 通常が生き続ける状態ならエラーなし（電マ○→×でHTML○ならHTML_BROWSINGへ切り替え）
  const keep = deriveDesiredState(m("off", "on", "blank"), false).desired;
  assert.equal(invalidTransitionIssue(true, keep, false), null);
});
