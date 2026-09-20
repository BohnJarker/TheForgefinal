import "./purchase.css";
import { offer, purchaseState, safeHttps } from "./commerce.js";
const state = purchaseState(offer);
document.querySelector("#price").textContent = state.price;
if (state.ready) {
  const buy = document.querySelector("#buy");
  buy.href = state.checkout;
  buy.removeAttribute("aria-disabled");
  buy.textContent = "Buy The Forge";
  document.querySelector("#purchase-note").textContent =
    "Continue to secure hosted checkout. Review license terms and delivery details before purchasing.";
}
for (const [label, value] of [
  ["License terms", offer.termsUrl],
  ["Privacy", offer.privacyUrl],
]) {
  const url = safeHttps(value);
  if (!url) continue;
  const link = document.createElement("a");
  link.textContent = label;
  link.href = url;
  document.querySelector("#legal-links").append(link);
}
