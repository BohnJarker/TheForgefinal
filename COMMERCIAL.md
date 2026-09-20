# One-time license launch

The owner selected a $15 one-time license, configured in USD. Gumroad is the proposed hosted checkout, download delivery, and license-key provider. Its signup page is open for the owner to complete account setup. No provider product, customer license terms, refund policy, or update entitlement is live yet. This repository does not accept payments or issue licenses yet. See SELLING.md for the prepared product listing and launch steps.

## Storefront

`purchase.html` is a customer-facing purchase page. Configure public values in `src/commerce.js`: amount (major currency units), ISO currency, HTTPS hosted checkout URL, published license terms URL, privacy URL, and support email. Checkout remains disabled until all are present. Test the provider's checkout before enabling live sales. The configured price must match the provider's product; this static page cannot validate the provider's price.

## Payment and delivery still required

Create a one-time product with a hosted checkout provider. Configure verified payment fulfillment to deliver the packaged app and purchased license. Handle refunds, chargebacks, taxes, customer support, and access revocation through the chosen provider/backend. Never treat a checkout redirect or browser storage flag as proof of purchase. Never place secret keys in this repository or frontend configuration.

There is no activation server, license enforcement, or purchase verification in this build. The public source and accessible workspace cannot be secured by a client-side paywall. A commercial offer may instead sell packaged downloads, support, and version-specific license rights; the owner must decide those rights before launching. No promise of lifetime updates is made.

## Distribution

Original application code has no open-source license grant in this repository. Dependency licenses remain separate and are included under `licenses/`; review their distribution requirements for the final commercial package. Customer terms need to identify the seller and define device/seat limits, supported platforms, update entitlement, refunds, and support. This document is an implementation checklist, not customer license terms.

## Current capabilities

Market this as an early local CAD application. Do not claim complete Shapr3D, Onshape, or Fusion parity. README.md and workspace Help describe the actual supported geometry and remaining gaps.
