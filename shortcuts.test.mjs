import assert from "node:assert/strict";
import { keyAction } from "./src/shortcuts.js";
const event = (key, extra = {}) => ({
  key,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  repeat: false,
  isComposing: false,
  ...extra,
});
for (const [key, type] of Object.entries({
  e: "extrude",
  f: "fillet",
  h: "shell",
  m: "transform",
  n: "transform",
  s: "scale",
  v: "revolve",
}))
  assert.deepEqual(keyAction(event(key)), { action: "tool", arg: type });
for (const [key, type] of Object.entries({
  r: "rect",
  c: "circle",
  g: "regular",
  l: "polygon",
}))
  assert.deepEqual(keyAction(event(key)), { action: "sketch-tool", arg: type });
for (const [key, operation] of Object.entries({
  u: "union",
  b: "cut",
  i: "intersect",
}))
  assert.deepEqual(keyAction(event(key, { ctrlKey: true })), {
    action: "boolean",
    arg: operation,
  });
for (const [i, view] of [
  "iso",
  "front",
  "back",
  "top",
  "bottom",
  "right",
  "left",
].entries())
  assert.deepEqual(keyAction(event(String(i + 1), { ctrlKey: true })), {
    action: "view",
    arg: view,
  });
assert.equal(keyAction(event("f"), { typing: true }), null);
assert.equal(keyAction(event("Delete"), { typing: true }), null);
assert.equal(keyAction(event("e"), { sketch: true }), null);
assert.equal(keyAction(event("f", { repeat: true })), null);
assert.equal(
  keyAction(event("z", { ctrlKey: true, shiftKey: true })).action,
  "redo",
);
assert.equal(keyAction(event("z", { ctrlKey: true })).action, "undo");
assert.equal(
  keyAction(event("h", { ctrlKey: true, altKey: true })).action,
  "history",
);
assert.equal(
  keyAction(event("s", { ctrlKey: true, altKey: true })).action,
  "items",
);
assert.equal(
  keyAction(event("Delete"), { historySelected: true }).action,
  "suppress",
);
assert.equal(
  keyAction(event("Delete", { shiftKey: true }), { historySelected: true })
    .action,
  "delete-feature",
);
assert.equal(keyAction(event("Delete")).action, "delete-body");
assert.equal(
  keyAction(event("Enter"), { sketch: true }).action,
  "finish-sketch",
);
assert.equal(keyAction(event("Escape"), { typing: true }).action, "escape");
assert.equal(keyAction(event("f", { ctrlKey: true })).action, "commands");
assert.equal(keyAction(event("x")).action, "commands");
assert.equal(keyAction(event("w")).action, "unavailable");
assert.equal(
  keyAction(event("a", { shiftKey: true }), { sketch: true }).action,
  "unavailable",
);
console.log(
  "PASS: Shapr3D tool, sketch, boolean, view, selection, history, and search key mappings",
);
console.log(
  "PASS: typing, sketch context, repeat, modifier priority, and unavailable-command handling",
);
