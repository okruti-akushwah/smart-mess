import test from "node:test";
import assert from "node:assert/strict";
import { safeReturnTo, returnTo, loginUrl } from "./authRouting.js";

test("preserves selected mess and meal through login and registration", () => {
  const destination = "/join/mess-b?next=%2Fcustomer%2Fchoose%23meal-42";
  const url = loginUrl(destination);
  assert.equal(returnTo({search: url.slice(url.indexOf("?"))}), destination);
  assert.equal(returnTo({search: "", state: {from: "/customer/choose#meal-42"}}), "/customer/choose#meal-42");
});
test("rejects external, malformed and authentication destinations", () => {
  for (const value of ["https://evil.test", "//evil.test", "/\\evil.test", "/login", "/register?next=x", "/owner/meals", null]) {
    assert.equal(safeReturnTo(value, "/customer"), "/customer");
  }
});
