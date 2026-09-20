# The Forge — verification record

Build date: September 19, 2026. Local Windows build, Node.js 24.16.0.

## Geometry and file exchange

`npm test`: all 16 geometry checks passed, plus shortcut routing and storefront configuration checks.

1. Box volume and triangle mesh match the analytic geometry.
2. A through hole removes the expected cylindrical volume.
3. Vertical fillets change the solid and match the expected rounded-rectangle volume.
4. All-edge chamfers produce smaller, valid solids.
5. Shelling removes the top and produces the expected inner dimensions and volume.
6. Cylinder translation and rotation preserve volume and update position.
7. Revolve produces the expected hollow-cylinder volume.
8. Closed profile extrusion works on XY, XZ, and YZ.
9. Linear pattern and mirror create the expected body count.
10. Boolean subtraction removes the expected volume and consumes its tool body.
11. STEP export/import preserves volume; binary STL has a correct header, triangle count, and byte length.
12. Failed features block dependent features.
13. Negative dimensions are rejected.
14. Suppressed source features block their dependents.
15. Uniform scaling changes volume by the cube of its factor.
16. Deleting a body removes it from the result.

Shortcut checks cover supported hotkeys, modifier routing, text-entry protection, and unimplemented-command routing. Storefront checks verify that incomplete configuration cannot enable checkout, invalid pricing is rejected, and checkout links must use HTTPS without embedded credentials.

Every accepted shape also passes OpenCascade's topology validity checker. These checks cover the tested shapes, not arbitrary geometry or printer performance.

The geometry review took two fix rounds (shell offset sign; ownership of transformed shapes), followed by a clean pass. The background-worker and topology-check integration passed the final suite.

## Browser verification

- Vertical tool rail rendered in the available narrow preview; the full desktop layout was checked at 1366 × 900, then the viewport override was reset.
- Editing the mounting plate from 96 to 110 mm rebuilt the dependent features. Undo and redo restored the expected dimensions.
- The hollow enclosure rebuilt successfully and displayed an 80 × 55 × 28 mm envelope.
- The 220 × 220 × 250 mm printer preset was selected and applied.
- A rectangle drawn with the sketch tool produced a 40 × 20 × 10 mm solid with the expected 8 cm³ volume.
- Reloading restored that sketch extrusion from local storage.
- STL export succeeded through Print Prep.
- E and F opened their modeling tools; Ctrl+4 selected the top view; Ctrl+Alt+H toggled History; X opened command search.
- The production build started at http://127.0.0.1:4173/ with its background worker and local WebAssembly asset. STEP export succeeded through its export dialog.

The UI review also corrected the printer preset markup, narrow-window accessible button labels, and historical body references used while editing boolean features.

## Build

`npm run build`: successful. Vite reports a large JavaScript bundle and a Node-only dependency branch externalized for browsers. The production browser launch and export were verified despite these nonfatal build notices.

See README.md for the implemented capabilities and current limits. This is an early working CAD application, not a validated replacement for all functions in Fusion, Onshape, or Shapr3D.
