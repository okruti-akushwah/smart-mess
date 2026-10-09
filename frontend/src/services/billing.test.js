import { test } from "node:test";
import assert from "node:assert/strict";
import { pendingBalance } from "./billing.js";

test("counts the latest bill once and includes separate meal orders", () => {
  assert.equal(pendingBalance([
    { id: 1, plan_id: 10, balance_due: 3000 },
    { id: 2, plan_id: 10, balance_due: 1000 },
    { id: 3, plan_id: 11, balance_due: 120 },
  ]), 1120);
});
test("live subscription balance replaces its issued estimate", () => {
  assert.equal(pendingBalance([{ id: 1, plan_id: 10, balance_due: 3000 }], { plan_id: 10, balance_due: 2950 }), 2950);
});
test("excludes cancelled orders and shows zero for fully paid bills", () => {
  assert.equal(pendingBalance([{ id: 1, plan_id: 10, balance_due: 3000, status: "cancelled" }, { id: 2, plan_id: 11, balance_due: 0 }]), 0);
});
test("includes a live bill before it has been issued", () => {
  assert.equal(pendingBalance([], { plan_id: 10, balance_due: 500 }), 500);
});
test("sums partial balances in cents", () => {
  assert.equal(pendingBalance([{ id: 1, plan_id: 10, balance_due: 0.1 }, { id: 2, plan_id: 11, balance_due: 0.2 }]), 0.3);
});
