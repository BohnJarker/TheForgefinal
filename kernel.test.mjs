import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  initKernel,
  buildModel,
  exportSTEP,
  exportSTL,
  importSTEP,
} from "./src/kernel.js";
await initKernel({
  wasmBinary: await readFile(
    new URL(
      "./node_modules/replicad-opencascadejs/dist/replicad_single.wasm",
      import.meta.url,
    ),
  ),
});
const f = (id, type, params) => ({ id, name: id, type, params });
const box = f("base", "box", { width: 40, depth: 30, height: 10 });
const approx = (v, expected, tol = 0.001) =>
  assert.ok(Math.abs(v - expected) < tol, `${v} should equal ${expected}`);
const clean = (r) =>
  assert.deepEqual(
    r.features.filter((f) => f.status !== "ok"),
    [],
  );
let r = await buildModel([box]);
clean(r);
approx(r.bodies[0].volume, 12000);
assert.equal(r.bodies[0].mesh.triangles.length, 36);
console.log("PASS: analytic box volume and tessellation");
r = await buildModel([
  box,
  f("hole", "hole", { targetId: "base", radius: 3, x: 0, y: 0 }),
]);
clean(r);
approx(r.bodies[0].volume, 12000 - Math.PI * 90);
console.log("PASS: through hole removes exact cylindrical volume");
r = await buildModel([
  box,
  f("fillet", "fillet", { targetId: "base", radius: 3, edges: "vertical" }),
]);
clean(r);
approx(r.bodies[0].volume, (1200 - (4 - Math.PI) * 9) * 10);
console.log("PASS: fillet changes solid geometry");
r = await buildModel([
  box,
  f("chamfer", "chamfer", { targetId: "base", radius: 2, edges: "all" }),
]);
clean(r);
assert.ok(r.bodies[0].volume < 12000);
console.log("PASS: all-edge chamfer");
r = await buildModel([
  box,
  f("shell", "shell", { targetId: "base", thickness: 2 }),
]);
clean(r);
approx(r.bodies[0].volume, 12000 - 36 * 26 * 8);
console.log("PASS: shell removes top and preserves exact wall thickness");
r = await buildModel([
  f("cyl", "cylinder", { radius: 8, height: 12 }),
  f("move", "transform", { targetId: "cyl", x: 5, y: 6, z: 7, rz: 45 }),
]);
clean(r);
approx(r.bodies[0].volume, Math.PI * 64 * 12);
approx(r.bodies[0].bounds.min[2], 7);
console.log("PASS: cylinder and move / rotation");
r = await buildModel([
  f("rev", "revolve", { radius: 20, thickness: 3, height: 15, angle: 360 }),
]);
clean(r);
approx(r.bodies[0].volume, Math.PI * (400 - 289) * 15);
console.log("PASS: revolve produces exact hollow cylinder");
for (const plane of ["XY", "XZ", "YZ"]) {
  r = await buildModel([
    f("ext", "extrude", {
      profile: "polygon",
      points: [
        [0, 0],
        [20, 0],
        [20, 10],
        [0, 10],
      ],
      height: 5,
      plane,
    }),
  ]);
  clean(r);
  approx(r.bodies[0].volume, 1000);
}
console.log("PASS: closed profile extrusion on all principal planes");
r = await buildModel([
  box,
  f("pattern", "linearPattern", {
    targetId: "base",
    count: 3,
    spacing: 50,
    axis: "X",
  }),
  f("mirror", "mirror", { targetId: "base", plane: "YZ" }),
]);
clean(r);
assert.equal(r.bodies.length, 4);
console.log("PASS: patterned and mirrored body creation");
const second = f("cyl", "cylinder", { radius: 8, height: 20 });
r = await buildModel([
  box,
  second,
  f("combine", "boolean", {
    targetId: "base",
    toolId: "cyl",
    operation: "cut",
  }),
]);
clean(r);
assert.equal(r.bodies.length, 1);
approx(r.bodies[0].volume, 12000 - Math.PI * 64 * 10);
console.log("PASS: boolean subtraction consumes tool");
const step = await exportSTEP(r.bodies);
const stepText = await step.text();
assert.match(stepText, /ISO-10303-21/);
const stl = await exportSTL(r.bodies);
assert.ok(stl.size > 100);
const stlBytes = new DataView(await stl.arrayBuffer());
assert.equal(stl.size, 84 + stlBytes.getUint32(80, true) * 50);
r = await buildModel([f("import", "imported", { importId: "step" })], {
  step: stepText,
});
clean(r);
approx(r.bodies[0].volume, 12000 - Math.PI * 64 * 10, 0.01);
console.log("PASS: real STEP round trip and nonempty binary STL");
r = await buildModel([
  box,
  f("bad", "fillet", { targetId: "base", radius: 2000 }),
  f("child", "hole", { targetId: "base", radius: 2, x: 0, y: 0 }),
]);
assert.equal(r.features[1].status, "error");
assert.equal(r.features[2].status, "blocked");
console.log("PASS: failed geometry blocks dependent features");
r = await buildModel([f("bad", "box", { width: -1, depth: 2, height: 3 })]);
assert.equal(r.features[0].status, "error");
assert.equal(r.bodies.length, 0);
console.log("PASS: invalid dimensions rejected");
r = await buildModel([
  { ...box, suppressed: true },
  f("child", "hole", { targetId: "base", radius: 2 }),
]);
assert.equal(r.features[1].status, "blocked");
console.log("PASS: suppressed source blocks dependents");
r = await buildModel([
  box,
  f("scaled", "scale", { targetId: "base", factor: 2 }),
]);
clean(r);
approx(r.bodies[0].volume, 96000);
console.log("PASS: uniform scale preserves cubic volume relationship");
r = await buildModel([box, f("removed", "deleteBody", { targetId: "base" })]);
clean(r);
assert.equal(r.bodies.length, 0);
console.log("PASS: body removal is a rebuildable history feature");
console.log("All geometry checks passed.");
