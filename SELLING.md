# Gumroad product setup — The Forge

Status: prepared locally; Gumroad account, product, checkout, and license delivery are not live yet.

## Product settings

- Name: The Forge — Early CAD Build
- Product type: Software / digital download (not a subscription)
- Price: USD 15, one-time; disable pay-what-you-want and installments
- Seller brand: Omni-Forge
- Delivery: upload the verified `The Forge.zip` package to Gumroad's product content
- License keys: enable Gumroad's software license-key generation before publishing
- Summary: A focused local CAD workspace for designing parts for 3D printing.

## Product description

**Make it yours. Then make it real.**

The Forge is an early desktop-browser CAD workspace from Omni-Forge, designed around a clear vertical tool menu and a spacious modeling canvas.

Create real solid geometry with boxes, cylinders, closed-profile extrusions, rectangular-section revolves, fillets, chamfers, shells, holes, transformations, mirrors, patterns, and boolean operations. Edit dimensions through feature history. Import and export STEP, export STL in millimeters, and compare part dimensions against your printer's build volume.

**What you receive**

- The Forge 0.1 downloadable application package
- A local launcher, setup guide, dependency notices, and example designs
- Editable `.forge` project saving and local browser autosave

**Requirements**

Windows with Node.js 22 or newer and a modern WebGL-capable browser. Extract the entire ZIP, then open `Start The Forge.cmd`. Keep the extracted files together. This release is a browser-based local application, not a standalone Windows installer. No ongoing internet connection is required for the included modeling build after setup.

**Please review before buying**

This is an early build. It does not include a general sketch constraint solver, assemblies, sweep, loft, manufacturing drawings, a slicer, or G-code generation. Supported keyboard commands follow a Shapr3D-style preset; full shortcut and feature parity is not claimed. See the included README and workspace Help for details. Print-volume checks do not replace inspection in your slicer.

The price is a one-time USD 15 purchase, not a recurring subscription. The final license terms and update entitlement must be supplied on this listing before sales open.

## Receipt and download instructions

Thank you for purchasing The Forge from Omni-Forge.

1. Download `The Forge.zip` using your purchase receipt or Gumroad library.
2. Extract the entire archive into a folder you control.
3. Ensure Node.js 22 or newer is installed from the official Node.js website.
4. Open `Start The Forge.cmd`. The local workspace opens in your browser.
5. Use Save to download backups of your `.forge` projects.

Keep your receipt and license key as your purchase record. This release does not ask you to enter the key inside the application; it does not implement activation or copy protection. For purchase or access issues, use the seller contact shown on your receipt.

## Before enabling the storefront

1. The owner completes Gumroad signup, terms acceptance, identity checks, and payout configuration privately.
2. Create the above product, upload the release package, and enable license-key generation.
3. Add the owner-approved customer license, refund policy, support contact, and privacy information. These business terms are not yet supplied.
4. Run Gumroad's test-purchase flow. Verify that the receipt contains the correct download and a license key, and that the downloaded package opens.
5. Set `checkoutUrl`, `termsUrl`, `privacyUrl`, and `supportEmail` in `src/commerce.js` to the real published values. Confirm the provider price is USD 15.
6. Run `npm test` and `npm run build`, then publish the updated storefront. Never add payment credentials to the repository.

Gumroad handles hosted checkout and content delivery. A license key is a purchase record in this release, not application-level enforcement. Do not advertise activation, device limits, or revocation until those are actually implemented.

Official references: [pricing](https://gumroad.com/pricing), [customer delivery](https://gumroad.com/help/article/282-how-do-purchases-work-for-my-customers), [license keys](https://gumroad.com/help/article/76-license-keys).
