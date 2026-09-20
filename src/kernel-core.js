import initOC from "replicad-opencascadejs";
import * as cad from "replicad";

let initialized, ocInstance;
let liveShapes = [];
export async function initKernel(options = {}) {
  if (!initialized)
    initialized = initOC({
      locateFile: () =>
        new URL(
          "../node_modules/replicad-opencascadejs/dist/replicad_single.wasm",
          import.meta.url,
        ).href,
      ...options,
    }).then((oc) => {
      cad.setOC(oc);
      ocInstance = oc;
      return oc;
    });
  return initialized;
}
const number = (v, label, min = -100000, max = 100000) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max)
    throw new Error(`${label} must be between ${min} and ${max}.`);
  return n;
};
const positive = (v, label) => number(v, label, 0.001, 10000);
const boundsOf = (shape) => {
  const bb = shape.boundingBox;
  const [min, max] = bb.bounds;
  bb.delete();
  return { min, max, size: max.map((v, i) => v - min[i]) };
};
const drop = (s) => {
  try {
    s?.delete();
  } catch {}
};
function polygon(points, plane = "XY") {
  if (!Array.isArray(points) || points.length < 3 || points.length > 500)
    throw Error("A profile needs 3–500 vertices.");
  const pts = points.map((p) => {
    if (!Array.isArray(p) || p.length !== 2)
      throw Error("Invalid sketch point.");
    return p.map((v) => number(v, "Sketch coordinate"));
  });
  // Reject self-crossing outlines before passing a wire into the solid kernel.
  const cross = (a, b, c) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i],
      b = pts[(i + 1) % pts.length];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6)
      throw Error("Sketch has overlapping consecutive points.");
    area += a[0] * b[1] - b[0] * a[1];
    for (let j = i + 2; j < pts.length; j++) {
      if (i === 0 && j === pts.length - 1) continue;
      const c = pts[j],
        d = pts[(j + 1) % pts.length];
      if (
        cross(a, b, c) * cross(a, b, d) < 0 &&
        cross(c, d, a) * cross(c, d, b) < 0
      )
        throw Error("Sketch edges cross. Draw a simple closed outline.");
    }
  }
  if (Math.abs(area) < 1e-5) throw Error("The sketch has no enclosed area.");
  const sk = new cad.Sketcher(plane).movePointerTo(pts[0]);
  for (const p of pts.slice(1)) sk.lineTo(p);
  return sk.close();
}
const planeName = (p) => {
  if (!["XY", "XZ", "YZ"].includes(p))
    throw Error("Choose the XY, XZ, or YZ plane.");
  return p;
};
function shapeFromFeature(f) {
  const p = f.params || {};
  switch (f.type) {
    case "box": {
      const w = positive(p.width, "Width"),
        d = positive(p.depth, "Depth"),
        h = positive(p.height, "Height");
      return cad.makeBox([-w / 2, -d / 2, 0], [w / 2, d / 2, h]);
    }
    case "cylinder":
      return cad.makeCylinder(
        positive(p.radius, "Radius"),
        positive(p.height, "Height"),
      );
    case "sphere":
      return cad.makeSphere(positive(p.radius, "Radius"));
    case "extrude": {
      let sketch;
      const plane = planeName(p.plane || "XY");
      if (p.profile === "rect") {
        const w = positive(p.width, "Width"),
          d = positive(p.depth, "Depth");
        sketch = polygon(
          [
            [-w / 2, -d / 2],
            [w / 2, -d / 2],
            [w / 2, d / 2],
            [-w / 2, d / 2],
          ],
          plane,
        );
      } else if (p.profile === "circle") {
        const center = p.center || [0, 0];
        let origin =
          plane === "XY"
            ? [center[0], center[1], 0]
            : plane === "XZ"
              ? [center[0], 0, center[1]]
              : [0, center[0], center[1]];
        sketch = cad.sketchCircle(positive(p.radius, "Radius"), {
          plane,
          origin,
        });
      } else sketch = polygon(p.points, plane);
      return sketch.extrude(positive(p.height, "Distance"));
    }
    case "revolve": {
      const r = positive(p.radius, "Radius"),
        w = positive(p.thickness, "Wall width"),
        h = positive(p.height, "Height"),
        angle = number(p.angle ?? 360, "Angle", 0.01, 360);
      if (w > r) throw Error("Wall width cannot exceed the outer radius.");
      return polygon(
        [
          [r - w, 0],
          [r, 0],
          [r, h],
          [r - w, h],
        ],
        "XZ",
      ).revolve([0, 0, 1], { origin: [0, 0, 0], angle });
    }
    default:
      return null;
  }
}
function validate(shape) {
  if (!shape || shape.isNull)
    throw Error("The operation did not produce a solid.");
  const volume = cad.measureVolume(shape);
  if (!Number.isFinite(volume) || volume < 1e-8)
    throw Error("The operation produced no solid volume.");
  const checker = new ocInstance.BRepCheck_Analyzer(
    shape.wrapped,
    true,
    false,
    false,
  );
  try {
    if (!checker.IsValid())
      throw Error(
        "The result has invalid topology. Adjust the feature dimensions.",
      );
  } finally {
    checker.delete();
  }
  return shape;
}
function modifier(f, base, tool) {
  const p = f.params;
  let source = base.clone();
  try {
    switch (f.type) {
      case "fillet":
      case "chamfer": {
        const r = positive(
          p.radius,
          f.type === "fillet" ? "Radius" : "Distance",
        );
        const next = source[f.type](
          r,
          p.edges === "all" ? undefined : (e) => e.inDirection("Z"),
        );
        drop(source);
        source = null;
        return validate(next);
      }
      case "shell": {
        const t = positive(p.thickness, "Wall thickness");
        const b = boundsOf(source);
        const next = source.shell(t, (e) => e.inPlane("XY", b.max[2]));
        drop(source);
        source = null;
        return validate(next);
      }
      case "hole": {
        const b = boundsOf(source),
          x = number(p.x ?? 0, "X"),
          y = number(p.y ?? 0, "Y"),
          r = positive(p.radius, "Radius");
        const cutter = cad.makeCylinder(
          r,
          b.size[2] + 2,
          [x, y, b.min[2] - 1],
          [0, 0, 1],
        );
        const before = cad.measureVolume(source);
        let next;
        try {
          next = source.cut(cutter);
        } finally {
          drop(cutter);
        }
        if (Math.abs(cad.measureVolume(next) - before) < 1e-6) {
          drop(next);
          throw Error(
            "The hole does not intersect the body. Change its position.",
          );
        }
        drop(source);
        source = null;
        return validate(next);
      }
      case "scale":
        source = source.scale(
          number(p.factor, "Scale factor", 0.001, 1000),
          [0, 0, 0],
        );
        return validate(source);
      case "transform":
        for (const [key, axis] of [
          ["rx", [1, 0, 0]],
          ["ry", [0, 1, 0]],
          ["rz", [0, 0, 1]],
        ]) {
          const a = number(p[key] ?? 0, key, -36000, 36000);
          if (a) source = source.rotate(a, [0, 0, 0], axis);
        }
        source = source.translate(
          number(p.x ?? 0, "X"),
          number(p.y ?? 0, "Y"),
          number(p.z ?? 0, "Z"),
        );
        return validate(source);
      case "boolean": {
        if (!tool) throw Error("Select a second solid as the tool.");
        const method = { union: "fuse", cut: "cut", intersect: "intersect" }[
          p.operation
        ];
        if (!method) throw Error("Invalid boolean operation.");
        const next = source[method](tool);
        drop(source);
        source = null;
        return validate(next);
      }
      default:
        throw Error("Unsupported feature: " + f.type);
    }
  } catch (e) {
    drop(source);
    throw e;
  }
}
export async function buildModel(features, imports = {}) {
  await initKernel();
  if (!Array.isArray(features) || features.length > 200)
    throw Error("A project supports up to 200 features.");
  const bodies = new Map(),
    states = [],
    failedBodies = new Set(),
    allocated = new Set();
  const own = (s) => {
    allocated.add(s);
    return s;
  };
  const replace = (id, name, shape) => {
    validate(shape);
    bodies.set(id, { id, name, shape: own(shape) });
  };
  for (const f of features) {
    const p = f.params || {};
    let bodyId = p.targetId || f.id;
    if (f.suppressed) {
      states.push({ id: f.id, status: "suppressed", bodyId });
      continue;
    }
    if (
      p.targetId &&
      (!bodies.has(p.targetId) || failedBodies.has(p.targetId))
    ) {
      states.push({
        id: f.id,
        status: "blocked",
        error: "An earlier feature for this body is missing or failed.",
        bodyId,
      });
      failedBodies.add(bodyId);
      continue;
    }
    try {
      const created = shapeFromFeature(f);
      if (created) replace(f.id, f.name, created);
      else if (f.type === "deleteBody") {
        bodies.delete(p.targetId);
      } else if (f.type === "imported") {
        const text = imports[p.importId];
        if (typeof text !== "string")
          throw Error("The STEP source is missing from this project.");
        const imported = await cad.importSTEP(new Blob([text]));
        replace(f.id, f.name, imported.asShape3D());
      } else if (f.type === "mirror") {
        const base = bodies.get(p.targetId);
        replace(
          f.id,
          f.name,
          base.shape.clone().mirror(planeName(p.plane || "YZ")),
        );
        bodyId = f.id;
      } else if (f.type === "linearPattern") {
        const count = number(p.count, "Instances", 2, 30);
        if (!Number.isInteger(count))
          throw Error("Instances must be a whole number.");
        const spacing = positive(p.spacing, "Spacing");
        const axis = { X: 0, Y: 1, Z: 2 }[p.axis || "X"];
        if (axis === undefined) throw Error("Invalid pattern direction.");
        for (let i = 1; i < count; i++) {
          const shift = [0, 0, 0];
          shift[axis] = i * spacing;
          replace(
            `${f.id}:${i}`,
            `${f.name} · ${i + 1}`,
            bodies.get(p.targetId).shape.clone().translate(shift),
          );
        }
      } else {
        const base = bodies.get(p.targetId);
        if (!base) throw Error("Choose a body for this operation.");
        if (
          f.type === "boolean" &&
          (p.toolId === p.targetId || failedBodies.has(p.toolId))
        )
          throw Error("Choose a different, valid tool body.");
        const next = modifier(f, base.shape, bodies.get(p.toolId)?.shape);
        replace(p.targetId, base.name, next);
        if (f.type === "boolean") bodies.delete(p.toolId);
      }
      states.push({ id: f.id, status: "ok", bodyId });
    } catch (e) {
      failedBodies.add(bodyId);
      states.push({
        id: f.id,
        status: "error",
        bodyId,
        error:
          typeof e === "number"
            ? "The solid kernel could not build this geometry. Try a smaller value or a different selection."
            : e.message || String(e),
      });
    }
  }
  const output = [];
  for (const b of bodies.values()) {
    try {
      output.push({
        ...b,
        mesh: b.shape.mesh({ tolerance: 0.08, angularTolerance: 0.15 }),
        edges: b.shape.meshEdges({ tolerance: 0.08, angularTolerance: 0.15 }),
        bounds: boundsOf(b.shape),
        volume: cad.measureVolume(b.shape),
        area: cad.measureArea(b.shape),
      });
    } catch (e) {
      states.push({
        id: b.id,
        status: "error",
        bodyId: b.id,
        error: "The result could not be displayed.",
      });
    }
  }
  const retained = new Set(output.map((b) => b.shape));
  for (const shape of allocated) if (!retained.has(shape)) drop(shape);
  for (const shape of liveShapes) drop(shape);
  liveShapes = [...retained];
  return { bodies: output, features: states };
}
export function exportSTEP(bodies) {
  if (!bodies.length) throw Error("No solids to export.");
  return cad.exportSTEP(
    bodies.map((b) => ({ shape: b.shape, name: b.name })),
    { unit: "MM", modelUnit: "MM" },
  );
}
export function exportSTL(bodies) {
  if (!bodies.length) throw Error("No solids to export.");
  const compound = cad.makeCompound(bodies.map((b) => b.shape));
  try {
    return compound.blobSTL({
      tolerance: 0.05,
      angularTolerance: 0.1,
      binary: true,
    });
  } finally {
    drop(compound);
  }
}
export async function importSTEP(blob) {
  await initKernel();
  return cad.importSTEP(blob);
}
