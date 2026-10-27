import { test } from "node:test";
import assert from "node:assert/strict";
import { computeImportDiff, type EntitlementContext } from "./accountAuthDiff";
import type { AccountAuth, AccountAuthInput, Authority } from "../repositories/accountAuth";
import type { Mark } from "./accountAuthEntitlement";

const ts = "2026-01-01 00:00:00";
const acct = (id: number, number: number, name: string, delfg = false): AccountAuth => ({
  id, accountName: name, password: "hash", comment: null, number,
  submission_date: null, regist_date: null, company_cd: null, company_name: null,
  company_store_cd: null, company_store_branch_num: null, non_sync: false,
  store_cd: null, store_name: null, reg_date: ts, upd_date: ts, delfg,
});
const rec = (number: number, name: string, delfg = false): AccountAuthInput => {
  const { id: _id, reg_date: _r, upd_date: _u, ...rest } = acct(0, number, name, delfg);
  return rest;
};
const marks = (manual: Mark, html: Mark, diag: Mark) => ({ manual, html, diag });
const ctx = (
  m: ReturnType<typeof marks>[],
  currentDiag: AccountAuth[] = [],
  auth: [number, Authority | null][] = [],
): EntitlementContext => ({ marks: m, currentDiag, currentAuthorities: new Map(auth) });

test("電マ○・HTML○の新規行：通常を追加し、権限ALL_MANUALを付ける", () => {
  const d = computeImportDiff([rec(1, "a")], [], ctx([marks("on", "on", "blank")]));
  assert.equal(d.added.length, 1);
  assert.deepEqual(d.entitlementChanges, [
    { line: 1, number: 1, accountName: "a", accountId: null, authority: { before: null, after: "ALL_MANUAL" }, diag: null },
  ]);
  assert.deepEqual(d.rowErrors, []);
});

test("通常に変更が無く権限だけ変わる行：changedには出ず、entitlementChangesに出る", () => {
  const cur = acct(10, 1, "a");
  const d = computeImportDiff([rec(1, "a")], [cur], ctx([marks("on", "on", "blank")], [], [[10, null]]));
  assert.equal(d.changed.length + d.added.length, 0);
  assert.equal(d.entitlementChanges.length, 1);
  assert.equal(d.entitlementChanges[0].accountId, 10);
  assert.equal(d.unchangedCount, 0);
});

test("電マ○→×でHTML○：権限がALL_MANUAL→HTML_BROWSINGに切り替わる（通常は消えない）", () => {
  const cur = acct(10, 1, "a");
  const d = computeImportDiff([rec(1, "a")], [cur], ctx([marks("off", "on", "blank")], [], [[10, "ALL_MANUAL"]]));
  assert.equal(d.deleted.length, 0);
  assert.deepEqual(d.entitlementChanges[0].authority, { before: "ALL_MANUAL", after: "HTML_BROWSING" });
});

test("多機能版HTML○→−：権限が外れる", () => {
  const cur = acct(10, 1, "a");
  const d = computeImportDiff([rec(1, "a")], [cur], ctx([marks("on", "blank", "blank")], [], [[10, "ALL_MANUAL"]]));
  assert.deepEqual(d.entitlementChanges[0].authority, { before: "ALL_MANUAL", after: null });
});

test("DIAGのみのユーザー（電マ×・HTMLなし・DIAG○）：通常は追加されず、DIAG用は生きたまま", () => {
  const diag = acct(5, 1, "a");
  const d = computeImportDiff([rec(1, "a")], [], ctx([marks("off", "blank", "on")], [diag]));
  assert.equal(d.added.length, 0);
  assert.deepEqual(d.entitlementChanges, []);
  assert.deepEqual(d.rowErrors, []);
  assert.equal(d.unchangedCount, 1);
});

test("DIAGのみのユーザーが電マ×・HTML○に：通常を新規追加してHTML_BROWSINGを付ける（DIAG用は残る）", () => {
  const diag = acct(5, 1, "a");
  const d = computeImportDiff([rec(1, "a")], [], ctx([marks("off", "on", "on")], [diag]));
  assert.equal(d.added.length, 1);
  assert.deepEqual(d.entitlementChanges[0].authority, { before: null, after: "HTML_BROWSING" });
  assert.equal(d.entitlementChanges[0].diag, null);
});

test("DIAG ○→空：DIAG用を論理削除。DIAG ×→○：論理削除済みを復活。DIAG○で行なしは何もしない", () => {
  const cur = acct(10, 1, "a");
  const alive = acct(5, 1, "a");
  const d1 = computeImportDiff([rec(1, "a")], [cur], ctx([marks("on", "blank", "blank")], [alive]));
  assert.deepEqual(d1.entitlementChanges[0].diag, { id: 5, before: "alive", after: "deleted" });

  const gone = acct(5, 1, "a", true);
  const d2 = computeImportDiff([rec(1, "a")], [cur], ctx([marks("on", "blank", "on")], [gone]));
  assert.deepEqual(d2.entitlementChanges[0].diag, { id: 5, before: "deleted", after: "alive" });

  const d3 = computeImportDiff([rec(1, "a")], [cur], ctx([marks("on", "blank", "on")], []));
  assert.deepEqual(d3.entitlementChanges, []);
});

test("解約日あり：通常・DIAG用を論理削除し、権限を外す", () => {
  const cur = acct(10, 1, "a");
  const alive = acct(5, 1, "a");
  const d = computeImportDiff([rec(1, "a", true)], [cur], ctx([marks("on", "on", "on")], [alive], [[10, "ALL_MANUAL"]]));
  assert.equal(d.deleted.length, 1);
  assert.deepEqual(d.entitlementChanges[0].authority, { before: "ALL_MANUAL", after: null });
  assert.deepEqual(d.entitlementChanges[0].diag, { id: 5, before: "alive", after: "deleted" });
});

test("エラー行（無効な記号／どこにも登録されない／生きている通常が電マ×・HTMLなしに）は一切更新しない", () => {
  const cur = acct(10, 1, "a");
  const cur2 = acct(11, 2, "b");
  const cur3 = acct(12, 3, "c");
  const changed = (n: number, name: string): AccountAuthInput => ({ ...rec(n, name), company_name: "変更" });
  const d = computeImportDiff(
    [changed(1, "a"), changed(2, "b"), changed(3, "c")],
    [cur, cur2, cur3],
    ctx([marks("invalid", "on", "blank"), marks("off", "blank", "blank"), marks("off", "blank", "on")]),
  );
  // 通常の項目変更（company_name）も含め、3行とも更新されない
  assert.equal(d.changed.length + d.added.length + d.entitlementChanges.length, 0);
  assert.equal(d.rowErrors.length, 3);
  assert.match(d.rowErrors[0].message, /無効な記号/);
  assert.match(d.rowErrors[1].message, /どこにも登録されない/);
  assert.match(d.rowErrors[2].message, /無効です/);
});

test("ctx省略時は従来どおり通常アカウントだけを比較する", () => {
  const d = computeImportDiff([rec(1, "a")], []);
  assert.equal(d.added.length, 1);
  assert.deepEqual(d.entitlementChanges, []);
  assert.deepEqual(d.rowErrors, []);
});
