// Shapr3D Windows hotkey preset. Context is explicit to keep text entry untouched.
export const shortcuts = [
  ["E", "Extrude"],
  ["F", "Fillet / Chamfer"],
  ["H", "Shell"],
  ["M", "Move / Rotate"],
  ["N", "Translate"],
  ["S", "Scale"],
  ["V", "Revolve"],
  ["R", "Rectangle"],
  ["C", "Circle"],
  ["G", "Polygon"],
  ["L", "Line / polyline"],
  ["Enter", "Finish sketch"],
  ["Ctrl+U", "Union"],
  ["Ctrl+B", "Subtract"],
  ["Ctrl+I", "Intersect"],
  ["X / Ctrl+F", "Command search"],
  ["Ctrl+Z", "Undo"],
  ["Ctrl+Shift+Z", "Redo"],
  ["Ctrl+1…7", "Isometric, front, back, top, bottom, right, left"],
  ["Space", "Zoom to hovered face"],
  ["Ctrl+A", "Select all bodies"],
  ["Shift+click", "Add / remove body from selection"],
  ["Esc / Ctrl+Shift+A", "Deselect"],
  ["Delete / Backspace", "Delete body; suppress selected history step"],
  ["Shift+Delete", "Delete selected history step"],
  ["Ctrl+Alt+S", "Show / hide Items"],
  ["Ctrl+Alt+H", "Show / hide History"],
  ["Ctrl+Shift+\\", "Show / hide project browser"],
];
export const unavailable = [
  ["A", "Arc"],
  ["I", "Spline"],
  ["O", "Offset sketch edge"],
  ["T", "Trim"],
  ["P", "Project geometry"],
  ["W", "Sweep"],
  ["Shift+A/C/E/V/N/L/M/P/S/T", "Sketch constraints"],
  ["Ctrl+Shift+S", "Select through"],
  ["Ctrl+Shift+V", "Variables"],
  ["Ctrl+Shift+C", "Copy screenshot"],
  ["Tab / E / F while area-selecting", "Face/edge selection filters"],
];
export function keyAction(
  e,
  {
    typing = false,
    sketch = false,
    historySelected = false,
    featureActive = false,
  } = {},
) {
  const key = e.key.toLowerCase(),
    ctrl = e.ctrlKey || e.metaKey,
    shift = e.shiftKey,
    alt = e.altKey;
  if (e.isComposing || e.repeat) return null;
  if (key === "escape") return { action: "escape" };
  if (typing && ctrl && !shift && !alt && key === "s")
    return { action: "save" };
  if (typing && ctrl && !shift && !alt && key === "f")
    return { action: "commands" };
  if (typing) return null;
  if (ctrl && alt) {
    if (key === "s") return { action: "items" };
    if (key === "h") return { action: "history" };
    return null;
  }
  if (ctrl) {
    if (shift && key === "\\") return { action: "items" };
    if (shift && key === "a") return { action: "deselect" };
    if (shift && key === "s")
      return { action: "unavailable", arg: "Select through" };
    if (shift && key === "v")
      return { action: "unavailable", arg: "Variables" };
    if (shift && key === "c")
      return { action: "unavailable", arg: "Screenshot clipboard" };
    if (shift && key === "i") return { action: "open" };
    if (key === "z") return { action: shift ? "redo" : "undo" };
    if (shift) return null;
    if ("1234567".includes(key) && key.length === 1)
      return {
        action: "view",
        arg: ["iso", "front", "back", "top", "bottom", "right", "left"][
          Number(key) - 1
        ],
      };
    if (key === "f" || key === "k") return { action: "commands" };
    if (key === "s") return { action: "save" };
    if (key === "a") return { action: "select-all" };
    if (key === "u") return { action: "boolean", arg: "union" };
    if (key === "b") return { action: "boolean", arg: "cut" };
    if (key === "i") return { action: "boolean", arg: "intersect" };
    return null;
  }
  if (alt) return null;
  if (key === "delete" || key === "backspace")
    return {
      action: sketch
        ? "sketch-back"
        : historySelected
          ? shift
            ? "delete-feature"
            : "suppress"
          : "delete-body",
    };
  if (shift) {
    if (sketch && "acevnlmpst".includes(key))
      return { action: "unavailable", arg: "Sketch constraints" };
    return null;
  }
  if (key === "x") return { action: "commands" };
  if (key === "enter")
    return sketch
      ? { action: "finish-sketch" }
      : featureActive
        ? { action: "apply" }
        : null;
  if (key === " ") return { action: "zoom-face" };
  if (key === "b") return { action: "body-filter" };
  if (["r", "c", "g", "l"].includes(key))
    return {
      action: "sketch-tool",
      arg: { r: "rect", c: "circle", g: "regular", l: "polygon" }[key],
    };
  if (["a", "i", "o", "t", "p", "w"].includes(key))
    return {
      action: "unavailable",
      arg: {
        a: "Arc",
        i: "Spline",
        o: "Offset sketch edge",
        t: "Trim",
        p: "Project geometry",
        w: "Sweep",
      }[key],
    };
  if (!sketch) {
    const type = {
      e: "extrude",
      f: "fillet",
      h: "shell",
      m: "transform",
      n: "transform",
      s: "scale",
      v: "revolve",
    }[key];
    if (type) return { action: "tool", arg: type };
  }
  return null;
}
