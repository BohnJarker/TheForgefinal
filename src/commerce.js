// Public storefront configuration only. Never put payment secrets here.
export const offer = {
  model: "one-time",
  amount: 15,
  currency: "USD",
  checkoutUrl: "",
  termsUrl: "",
  privacyUrl: "",
  supportEmail: "",
};

export function safeHttps(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function purchaseState(config) {
  const priced = Number.isFinite(config.amount) && config.amount > 0;
  let price = "Price to be announced";
  try {
    if (priced)
      price = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: config.currency,
      }).format(config.amount);
  } catch {
    return { ready: false, price, checkout: null };
  }
  const checkout = safeHttps(config.checkoutUrl);
  const ready = Boolean(
    priced &&
      checkout &&
      safeHttps(config.termsUrl) &&
      safeHttps(config.privacyUrl) &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.supportEmail),
  );
  return { ready, price, checkout: ready ? checkout : null };
}
