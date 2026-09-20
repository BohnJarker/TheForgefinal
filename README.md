# The Forge

A local, printer-focused CAD workspace for Omni-Forge. Version 0.1.

## Open the app

Double-click **Start The Forge.cmd**. It starts a local server and opens the application in your browser at **http://127.0.0.1:4173/**. Node.js 22 or newer is required and is already installed on this computer. No account or internet connection is needed to run the included build.

The entire folder must stay together. The HTML file cannot run by itself because the app includes a real solid geometry engine and background worker.

## Workspace

- **Sketch:** draw one closed rectangle, circle, or polygon on XY, XZ, or YZ; use millimeter snapping; finish with an extrusion distance.
- **Model:** use the vertical toolbar to create and modify real solids. Select a history feature to edit its dimensions, suppress it, or delete it. Changes rebuild later features.
- **Inspect:** check body dimensions, volume, surface area, and a visual section.
- **Print Prep:** define a printer build volume, compare individual part sizes, center a part on the bed, and export STL.

The original knife outline from Forge Sculpt is available under **Example designs**. Its footprint is 108.5 × 27 mm, with a 4 mm extrusion. Other examples are a mounting plate and a hollow enclosure.

## Working modeling operations

Box, cylinder, sphere (through command search), closed-profile extrude, rectangular-section revolve, fillet and chamfer (all or vertical edges), top-open shell, vertical through holes, translation and rotation, mirror, linear body pattern, and boolean union/subtract/intersection. Geometry is calculated by OpenCascade through Replicad, in a background worker.

STEP import creates an editable downstream solid feature. STEP export contains exact boundary geometry. Binary STL export uses a 0.05 mm meshing tolerance with coordinates in millimeters. Hidden bodies are excluded. Failed or blocked features prevent export until resolved or suppressed.

**Save** downloads an editable `.forge` project containing the feature history and any imported STEP data. The browser also saves the current design locally. Keep downloaded project backups; clearing browser storage clears the local autosave. The production app and development preview have separate browser autosaves because they use different ports.

## Controls

Right-drag: orbit. Middle-drag or Shift+right-drag: pan. Scroll: zoom. E: extrude. F: fillet/chamfer. H: shell. M: move/rotate. S: scale. X or Ctrl+F: command search. Ctrl+1 through Ctrl+7: standard views. Ctrl+Alt+S: Items. Ctrl+Alt+H: History. Ctrl+Z: undo. Ctrl+Shift+Z: redo. Ctrl+S: save. Escape: cancel or deselect. Help lists the full implemented preset and unavailable commands.

The compact vertical rail groups Sketch, Add, Transform, Tools, Inspect, and Print. Items, History, and tool properties open on demand.

## One-time license storefront

Open `purchase.html` through the local server to preview the $15 USD one-time offer. Checkout is disabled until a hosted payment link and business details are configured. See COMMERCIAL.md. No payments, activation checks, or automatic license delivery are implemented yet.

## Scope of this build

This is a working early CAD application, not complete Shapr3D/Onshape/Fusion parity. It has no general sketch constraint solver, individual face push/pull, individually selectable fillet edges, assembly mates, loft/sweep workflows, manufacturing drawings, sculpting, simulation, slicer, G-code generation, cloud collaboration, or production certification. The current sketcher creates one profile at a time and does not edit vertices of committed sketches. Feature dimensions and extrusion depth remain editable.

Print-bed checks compare each part’s bounding dimensions with the printer dimensions; they do not certify an arranged multi-part build or check minimum wall thickness, overhangs, supports, material shrinkage, or machine calibration. Finish preparation and inspect the STL in your slicer. A section view clips the display; it does not split or cap the exported solid.

## Develop and verify

Run `npm ci`, then `npm run dev`. Run `npm test` for analytic geometry and exchange-format checks, and `npm run build` to update the included production build.

Main source files are `src/main.js` (workspace and project state), `src/styles.css` (interface), `src/viewport.js` (3D display), `src/kernel-core.js` (solid operations), and `src/kernel.worker.js` (background computation).

The build was checked against analytic box, hole, fillet, shell, cylinder, and revolve volumes; extrusion on three planes; transformations and patterns; boolean subtraction; STEP round trips; binary STL structure; and failure/suppression handling. Browser checks cover feature editing, persistence, undo/redo, sketches, print settings, and exports.

## Dependencies and licenses

Replicad, Three.js, Lucide, and Vite are MIT-licensed. The bundled Replicad OpenCascade WebAssembly build is LGPL-2.1-only; the kernel is distributed as a separate replaceable asset. License files are in `licenses/`. Upstream source: [Replicad](https://github.com/sgenoud/replicad), [OpenCascade.js](https://github.com/donalffons/opencascade.js), [OpenCascade Technology](https://github.com/Open-Cascade-SAS/OCCT), [Three.js](https://github.com/mrdoob/three.js), [Lucide](https://github.com/lucide-icons/lucide), and [Vite](https://github.com/vitejs/vite).
