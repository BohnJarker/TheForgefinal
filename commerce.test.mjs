import assert from "node:assert/strict";
import { offer, purchaseState, safeHttps } from "./src/commerce.js";
assert.equal(purchaseState(offer).ready, false);
const valid = {
  amount: 99,
  currency: "USD",
  checkoutUrl: "https://example.com/pay",
  termsUrl: "https://example.com/terms",
  privacyUrl: "https://example.com/privacy",
  supportEmail: "help@example.com",
};
assert.equal(purchaseState(valid).ready, true);
for (const patch of [
  { amount: 0 },
  { amount: -1 },
  { amount: NaN },
  { checkoutUrl: "javascript:alert(1)" },
  { checkoutUrl: "http://example.com" },
  { termsUrl: "" },
  { privacyUrl: "" },
  { supportEmail: "" },
  { currency: "invalid" },
]) {
  assert.equal(purchaseState({ ...valid, ...patch }).ready, false);
}
assert.equal(safeHttps("https://user:password@example.com"), null);
assert.equal(purchaseState(valid).price, "$99.00");
console.log(
  "PASS storefront stays disabled until checkout configuration is complete; rejects unsafe links and invalid pricing",
);
