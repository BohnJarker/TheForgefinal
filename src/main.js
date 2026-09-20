import "./styles.css";
import { keyAction, shortcuts, unavailable } from "./shortcuts.js";
import { createIcons, icons } from "lucide";
import { CADViewport } from "./viewport.js";
import {
  initKernel,
  buildModel,
  exportSTEP,
  exportSTL,
  importSTEP,
} from "./kernel.js";

const $ = (q) => document.querySelector(q);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const ico = (name) => `<i data-lucide="${name}"></i>`;
const iconize = () => createIcons({ icons, attrs: { "stroke-width": 1.6 } });
const uid = () => crypto.randomUUID();
const clone = (x) => structuredClone(x);
const STORAGE = "omni-forge-project-v1";
function validDocument(data) {
  return (
    data &&
    data.schema === "omni-forge/1" &&
    typeof data.name === "string" &&
    data.name.length <= 80 &&
    Array.isArray(data.features) &&
    data.features.length <= 200 &&
    new Set(data.features.map((f) => f?.id)).size === data.features.length &&
    data.features.every(
      (f) =>
        f &&
        Object.hasOwn(definitions, f.type) &&
        typeof f.id === "string" &&
        /^[a-zA-Z0-9_:-]{1,100}$/.test(f.id) &&
        typeof f.name === "string" &&
        f.name.length <= 200 &&
        f.params &&
        typeof f.params === "object" &&
        !Array.isArray(f.params),
    )
  );
}
const knife = [
  [16, 78],
  [46, 62],
  [88, 55],
  [130, 52],
  [152, 52],
  [161, 44],
  [226, 46],
  [233, 62],
  [233, 85],
  [225, 98],
  [161, 96],
  [152, 94],
  [116, 93],
  [76, 89],
].map(([x, y]) => [(x - 124.5) / 2, (71 - y) / 2]);
const definitions = {
  box: {
    label: "Box",
    icon: "box",
    group: "Create",
    description: "Create a solid from three precise dimensions.",
    fields: [
      ["width", "Width", 64],
      ["depth", "Depth", 44],
      ["height", "Height", 12],
    ],
  },
  cylinder: {
    label: "Cylinder",
    icon: "cylinder",
    group: "Create",
    description: "Create a round solid on the XY plane.",
    fields: [
      ["radius", "Radius", 15],
      ["height", "Height", 30],
    ],
  },
  sphere: {
    label: "Sphere",
    icon: "circle",
    group: "Create",
    description: "Create a spherical solid.",
    fields: [["radius", "Radius", 20]],
  },
  extrude: {
    label: "Extrude",
    icon: "arrow-up-from-line",
    group: "Create",
    description: "Give a closed sketch depth to create a solid.",
    fields: [["height", "Distance", 20]],
  },
  revolve: {
    label: "Revolve",
    icon: "rotate-3d",
    group: "Create",
    description: "Revolve a rectangular section around the vertical axis.",
    fields: [
      ["radius", "Outer radius", 22],
      ["thickness", "Wall width", 4],
      ["height", "Height", 28],
      ["angle", "Angle", 360, "°"],
    ],
  },
  fillet: {
    label: "Fillet",
    icon: "radius",
    group: "Modify",
    description: "Round edges with a true circular blend.",
    target: true,
    fields: [["radius", "Radius", 2]],
  },
  chamfer: {
    label: "Chamfer",
    icon: "triangle-right",
    group: "Modify",
    description: "Bevel edges with a consistent chamfer.",
    target: true,
    fields: [["radius", "Distance", 1]],
  },
  shell: {
    label: "Shell",
    icon: "package-open",
    group: "Modify",
    description: "Remove the top face and hollow the body.",
    target: true,
    fields: [["thickness", "Wall thickness", 2]],
  },
  hole: {
    label: "Hole",
    icon: "circle-dot",
    group: "Modify",
    description: "Cut a circular hole vertically through the body.",
    target: true,
    fields: [
      ["radius", "Radius", 3],
      ["x", "Position X", 0],
      ["y", "Position Y", 0],
    ],
  },
  transform: {
    label: "Move / rotate",
    icon: "move-3d",
    group: "Transform",
    description: "Position your body with exact offsets and angles.",
    target: true,
    fields: [
      ["x", "Move X", 0],
      ["y", "Move Y", 0],
      ["z", "Move Z", 0],
      ["rx", "Rotate X", 0, "°"],
      ["ry", "Rotate Y", 0, "°"],
      ["rz", "Rotate Z", 0, "°"],
    ],
  },
  mirror: {
    label: "Mirror",
    icon: "flip-horizontal-2",
    group: "Transform",
    description: "Create a reflected copy across a principal plane.",
    target: true,
    fields: [],
  },
  linearPattern: {
    label: "Pattern",
    icon: "grid-2x2",
    group: "Transform",
    description: "Repeat a body along a straight line.",
    target: true,
    fields: [
      ["count", "Instances", 3, ""],
      ["spacing", "Spacing", 40],
    ],
  },
  boolean: {
    label: "Combine",
    icon: "combine",
    group: "Modify",
    description: "Join, subtract, or intersect two solid bodies.",
    target: true,
    fields: [],
  },
  scale: {
    label: "Scale",
    icon: "scaling",
    group: "Transform",
    description: "Scale a body uniformly about the origin.",
    target: true,
    fields: [["factor", "Scale factor", 1, ""]],
  },
  deleteBody: {
    label: "Remove body",
    icon: "trash-2",
    group: "Modify",
    target: true,
    fields: [],
  },
  imported: {
    label: "Imported STEP",
    icon: "file-box",
    group: "Create",
    fields: [],
  },
};
let doc = {
  schema: "omni-forge/1",
  name: "Mounting plate",
  features: [],
  printer: { name: "Custom printer", width: 256, depth: 256, height: 256 },
  imports: {},
};
let undoStack = [],
  redoStack = [],
  result = { bodies: [], features: [] },
  selected = null,
  selectedFeature = null,
  draft = null,
  busy = false,
  ready = false,
  mode = "model",
  visible = new Map(),
  sketch = null;
let filter = "";
let activeMenu = null,
  inspectorOpen = false,
  selectedIds = new Set();
const app = $("#app");
app.innerHTML = `
 <header class="topbar"><div class="brand"><span class="brandmark">F</span><span class="brand-light">THE</span> FORGE</div><span class="app-version">STUDIO</span><div class="topdivider"></div><div class="document"><input id="document-name" aria-label="Document name" maxlength="80"><small id="save-label">Local design workspace</small></div><div class="spacer"></div><button class="topbutton" data-action="commands" title="Search commands (X / Ctrl+F)">${ico("search")}<span>Search</span></button><button class="topbutton" data-action="open" title="Open project or STEP">${ico("folder-open")}<span>Open</span></button><button class="topbutton" data-action="save" aria-label="Save">${ico("save")}<span>Save</span></button><button class="topbutton primary" data-action="export" aria-label="Export">${ico("upload")}<span>Export</span></button><button class="topbutton" data-action="help" title="Help">${ico("circle-help")}</button></header>
 <nav class="workspacebar"><button class="workspacebutton" data-mode="sketch">${ico("pencil-ruler")}SKETCH</button><button class="workspacebutton active" data-mode="model">${ico("box")}MODEL</button><button class="workspacebutton" data-mode="inspect">${ico("scan-line")}INSPECT</button><button class="workspacebutton" data-mode="print">${ico("printer")}PRINT PREP</button><div class="spacer"></div><span class="mode-label">${ico("hard-drive")} On this device</span></nav>
 <div class="ribbon" id="ribbon"></div>
 <main class="content"><aside class="treepanel"><div class="panelhead">${ico("layers-2")}Design browser<span class="spacer"></span><button class="iconbutton" data-action="examples" title="New design / examples">${ico("plus")}</button></div><div class="treesearch">${ico("search")}<input id="tree-search" aria-label="Filter features" placeholder="Find in design…"></div><div class="tree-scroll" id="tree"></div><div class="tree-footer">${ico("shield-check")}<span id="kernel-label">Starting solid engine…</span></div></aside>
 <section class="viewport-wrap"><div id="viewport" class="viewport"></div><div class="view-heading"><div class="eyebrow">THE FORGE / DESIGN STUDIO</div><h1 id="view-title">Mounting plate</h1><p id="view-subtitle">Every good part starts with an idea.</p></div><div id="selection-pill"></div><div class="viewcube"><button class="cube-top" data-view="top" title="Top view">TOP</button><button class="cube-front" data-view="front" title="Front view">FRONT</button><button class="cube-right" data-view="right" title="Right view">RIGHT</button><button class="cube-iso" data-view="iso">ISOMETRIC ↗</button></div><div class="view-tools"><button class="iconbutton" data-action="fit" title="Fit to view">${ico("scan")}</button><div class="divider"></div><button class="iconbutton active" id="grid-toggle" data-action="grid" title="Toggle grid">${ico("grid-3x3")}</button><button class="iconbutton active" id="edges-toggle" data-action="edges" title="Toggle edges">${ico("box")}</button><button class="iconbutton" id="section-toggle" data-action="section" title="Section view">${ico("slice")}</button><div class="divider"></div><button class="iconbutton" data-action="inspect" title="Measure selected body">${ico("ruler")}</button></div><div class="axis-label"><span style="color:#c47870">X</span><span style="color:#6a9a7b">Y</span><span style="color:#6f98c2">Z</span> · mm</div><div class="view-hint"><b>Right-drag</b> to orbit &nbsp;·&nbsp; <b>Middle-drag</b> to pan &nbsp;·&nbsp; <b>Scroll</b> to zoom</div><div class="loader" id="loader"><div class="spinner"></div><span id="load-text">Starting the modeling engine</span></div></section>
 <aside class="inspector"><div class="panelhead" id="inspector-title">${ico("sliders-horizontal")}Properties</div><div class="inspector-body" id="inspector"></div></aside></main>
 <div class="historybar"><div class="historylabel">Design history<b id="history-count">0 features</b></div><div class="historycontrols"><button class="iconbutton" data-action="undo" id="undo" title="Undo (Ctrl+Z)">${ico("undo-2")}</button><button class="iconbutton" data-action="redo" id="redo" title="Redo (Ctrl+Shift+Z)">${ico("redo-2")}</button></div><div class="timeline" id="timeline"></div><button class="iconbutton" data-action="examples" title="Example designs">${ico("layout-grid")}</button></div>
 <footer class="statusbar"><span class="status-main" id="status">Loading geometry engine</span><span id="body-count">0 bodies</span><span class="mono">Millimeters</span><span>Local workspace</span></footer><input type="file" id="file-input" accept=".json,.forge,.omni,.step,.stp" hidden><div id="modal-root"></div><div id="toast-root"></div>`;
$(".content").prepend($("#ribbon"));
$(".viewport-wrap").insertAdjacentHTML(
  "beforeend",
  '<div id="tool-flyout"></div>',
);
const viewport = new CADViewport($("#viewport"), {
  onSelect: (id, additive) => selectBody(id, additive),
  onStatus: (message) => status(message),
});
function status(message) {
  $("#status").textContent = message;
}
let toastTimer;
function toast(message) {
  $("#toast-root").innerHTML =
    `<div role="status" class="toast">${esc(message)}</div>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("#toast-root").innerHTML = ""), 4500);
}
function saveLocal() {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(doc));
    $("#save-label").textContent = "Saved on this device";
  } catch {
    $("#save-label").textContent = "Download a project to save";
  }
}
function snapshot() {
  undoStack.push(clone(doc));
  if (undoStack.length > 40) undoStack.shift();
  redoStack = [];
}
function updateDocName() {
  $("#document-name").value = doc.name;
  $("#view-title").textContent = doc.name;
  document.title = `${doc.name} · The Forge`;
}
function tool(type, extra = "") {
  const d = definitions[type];
  return `<button class="tool ${draft?.type === type ? "active" : ""} ${extra}" data-tool="${type}" title="${esc(d.description || d.label)}">${ico(d.icon)}<span>${d.label}</span></button>`;
}
function drawRibbon() {
  const button = (label, icon, attr, active = false) =>
    `<button class="rail-button ${active ? "active" : ""}" ${attr}>${ico(icon)}<span>${label}</span></button>`;
  if (sketch) {
    $("#ribbon").innerHTML =
      button("Done", "check", 'data-action="finish-sketch"') +
      button(
        "Line",
        "spline",
        'data-sketch-tool="polygon"',
        sketch.tool === "polygon",
      ) +
      button(
        "Rectangle",
        "rectangle-horizontal",
        'data-sketch-tool="rect"',
        sketch.tool === "rect",
      ) +
      button(
        "Circle",
        "circle",
        'data-sketch-tool="circle"',
        sketch.tool === "circle",
      ) +
      button(
        "Polygon",
        "pentagon",
        'data-sketch-tool="regular"',
        sketch.tool === "regular",
      ) +
      '<div class="rail-spacer"></div>' +
      button("Cancel", "x", 'data-action="cancel-sketch"');
  } else
    $("#ribbon").innerHTML =
      button("Sketch", "pencil-ruler", 'data-action="sketch"') +
      button("Add", "plus", 'data-menu="Add"', activeMenu === "Add") +
      button(
        "Transform",
        "move-3d",
        'data-menu="Transform"',
        activeMenu === "Transform",
      ) +
      button("Tools", "wrench", 'data-menu="Tools"', activeMenu === "Tools") +
      '<div class="rail-rule"></div>' +
      button("Inspect", "ruler", 'data-mode="inspect"', mode === "inspect") +
      button("Print", "printer", 'data-mode="print"', mode === "print") +
      '<div class="rail-spacer"></div>' +
      button(
        "Items",
        "layers-2",
        'data-action="toggle-items"',
        app.classList.contains("items-open"),
      ) +
      button(
        "History",
        "history",
        'data-action="toggle-history"',
        app.classList.contains("history-open"),
      );
  drawFlyout();
  iconize();
}
function drawFlyout() {
  const menu = $("#tool-flyout");
  if (!activeMenu) {
    menu.innerHTML = "";
    return;
  }
  const types =
    {
      Add: ["box", "cylinder", "sphere"],
      Transform: ["transform", "scale", "mirror", "linearPattern"],
      Tools: [
        "extrude",
        "fillet",
        "chamfer",
        "shell",
        "hole",
        "revolve",
        "boolean",
      ],
    }[activeMenu] || [];
  const hotkeys = {
    extrude: "E",
    fillet: "F",
    shell: "H",
    transform: "M",
    scale: "S",
    revolve: "V",
  };
  menu.innerHTML = `<section class="tool-menu"><div class="tool-menu-head">${activeMenu}<button class="iconbutton" data-action="close-tools" aria-label="Close tools">${ico("x")}</button></div>${types.map((type) => `<button class="tool-menu-row" data-tool="${type}">${ico(definitions[type].icon)}<span>${definitions[type].label}</span>${hotkeys[type] ? "<kbd>" + hotkeys[type] + "</kbd>" : ""}</button>`).join("")}${activeMenu === "Add" ? `<div class="rail-rule"></div><button class="tool-menu-row" data-action="open">${ico("file-input")}<span>Import file</span></button><button class="tool-menu-row" data-action="examples">${ico("layout-grid")}<span>Example designs</span></button>` : ""}</section>`;
}
function openMenu(name) {
  if (sketch || busy) return;
  activeMenu = activeMenu === name ? null : name;
  mode = "model";
  inspectorOpen = false;
  drawInspector();
  drawRibbon();
}
function setPanel(open) {
  inspectorOpen = open;
  app.classList.toggle("inspector-open", open);
}
function toggleItems() {
  app.classList.toggle("items-open");
  drawRibbon();
}
function toggleHistory() {
  app.classList.toggle("history-open");
  drawRibbon();
}

function drawTree() {
  const matches = (f) =>
    (f.name + " " + f.type).toLowerCase().includes(filter.toLowerCase());
  $("#tree").innerHTML =
    `<div class="sectionlabel">${ico("chevron-down")}Origin</div>${["XY · Top", "XZ · Front", "YZ · Right"].map((name, i) => `<div class="tree-row origin-row" data-view="${["top", "front", "right"][i]}">${ico("square-dashed")}<span>${name}</span></div>`).join("")}<div class="sectionlabel">${ico("chevron-down")}Bodies <span class="spacer"></span>${result.bodies.length}</div>${result.bodies.map((b) => `<div class="tree-row ${selected === b.id ? "selected" : ""}" data-body="${b.id}">${ico("box")}<span class="rowname">${esc(b.name)}</span><button class="eye ${visible.get(b.id) === false ? "off" : ""}" data-visibility="${b.id}" title="Show / hide body">${ico(visible.get(b.id) === false ? "eye-off" : "eye")}</button></div>`).join("")}${!result.bodies.length ? '<div class="empty-state">Create a sketch or solid<br>to begin your design.</div>' : ""}<div class="sectionlabel">${ico("chevron-down")}Features <span class="spacer"></span>${doc.features.length}</div>${doc.features
      .filter(matches)
      .map((f) => {
        const r = result.features.find((r) => r.id === f.id);
        return `<div class="tree-row ${selectedFeature === f.id ? "selected" : ""} ${f.suppressed ? "suppressed" : ""} ${["error", "blocked"].includes(r?.status) ? "error" : ""}" data-feature="${f.id}" title="${esc(r?.error || "Click to edit parameters")}">${ico(["error", "blocked"].includes(r?.status) ? "circle-alert" : definitions[f.type]?.icon || "box")}<span class="rowname">${esc(f.name)}</span><small>${f.suppressed ? "OFF" : ["error", "blocked"].includes(r?.status) ? "!" : ""}</small></div>`;
      })
      .join("")}`;
  $("#timeline").innerHTML =
    doc.features
      .map(
        (f) =>
          `<button class="historyitem ${selectedFeature === f.id ? "selected" : ""} ${f.suppressed ? "suppressed" : ""} ${result.features.find((r) => r.id === f.id)?.status === "error" ? "error" : ""}" data-feature="${f.id}" title="${esc(f.name)}">${ico(definitions[f.type]?.icon || "box")}</button>`,
      )
      .join("") + '<div class="timeline-end"></div>';
  $("#history-count").textContent = `${doc.features.length} features`;
  $("#body-count").textContent =
    `${result.bodies.length} solid ${result.bodies.length === 1 ? "body" : "bodies"}`;
  $("#undo").disabled = !undoStack.length || busy;
  $("#redo").disabled = !redoStack.length || busy;
  iconize();
}
function selectedBody() {
  return result.bodies.find((b) => b.id === selected) || result.bodies[0];
}
function availableBodies() {
  if (!draft || draft.isNew) return result.bodies;
  const index = doc.features.findIndex((f) => f.id === draft.id),
    bodies = new Map();
  for (const f of doc.features.slice(0, index)) {
    if (f.suppressed) continue;
    if (
      [
        "box",
        "sphere",
        "cylinder",
        "extrude",
        "revolve",
        "imported",
        "mirror",
      ].includes(f.type)
    )
      bodies.set(f.id, { id: f.id, name: f.name });
    if (f.type === "linearPattern")
      for (let i = 1; i < Math.min(30, f.params.count); i++)
        bodies.set(`${f.id}:${i}`, {
          id: `${f.id}:${i}`,
          name: `${f.name} · ${i + 1}`,
        });
    if (f.type === "boolean") bodies.delete(f.params.toolId);
    if (f.type === "deleteBody") bodies.delete(f.params.targetId);
  }
  return [...bodies.values()];
}
function selectBody(id, additive = false) {
  if (sketch) return;
  if (additive && id) {
    if (selectedIds.has(id)) selectedIds.delete(id);
    else selectedIds.add(id);
  } else selectedIds = new Set(id ? [id] : []);
  selected = [...selectedIds].at(-1) || null;
  activeMenu = null;
  selectedFeature = null;
  draft = null;
  viewport.select([...selectedIds]);
  drawTree();
  drawInspector();
  updatePill();
  drawRibbon();
}
function updatePill() {
  const b = result.bodies.find((b) => b.id === selected);
  $("#selection-pill").innerHTML = b
    ? `<div class="selectionpill">${ico("box")}${esc(b.name)}<span>· Solid body</span></div>`
    : "";
  iconize();
}
function getBounds(b) {
  const bounds = b?.bounds;
  if (!bounds) return [0, 0, 0];
  if (bounds.size) return bounds.size;
  if (Array.isArray(bounds) && bounds.length === 2)
    return bounds[1].map((v, i) => v - bounds[0][i]);
  if (bounds.min && bounds.max)
    return bounds.max.map((v, i) => v - bounds.min[i]);
  return [0, 0, 0];
}
function dim(v) {
  return Number(v || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
}
function field(name, label, value, unit = "mm", options) {
  return `<label class="field"><span>${esc(label)}</span>${
    options
      ? `<select name="${name}">${options
          .map((o) => {
            const [v, l] = Array.isArray(o) ? o : [o, o];
            return `<option value="${esc(v)}" ${String(value) === String(v) ? "selected" : ""}>${esc(l)}</option>`;
          })
          .join("")}</select>`
      : `<div class="inputunit"><input type="number" step="any" name="${name}" value="${Number.isFinite(Number(value)) ? Number(value) : 0}" required ${["radius", "thickness", "width", "depth", "height", "spacing"].includes(name) ? 'min="0.01"' : ""} ${name === "count" ? 'min="2" max="30"' : ""}><em>${unit}</em></div>`
  }</label>`;
}
function setInspectorTitle(label, icon = "sliders-horizontal") {
  $("#inspector-title").innerHTML =
    ico(icon) +
    esc(label) +
    '<span class="spacer"></span><button class="iconbutton" data-action="close-panel" aria-label="Close panel">' +
    ico("x") +
    "</button>";
}
function drawInspector() {
  setPanel(
    !!sketch ||
      !!draft ||
      inspectorOpen ||
      mode === "print" ||
      mode === "inspect",
  );
  if (sketch) {
    drawSketchInspector();
    return;
  }
  if (draft) {
    drawFeatureForm();
    return;
  }
  const b = selectedBody();
  if (mode === "print") {
    drawPrint();
    return;
  }
  setInspectorTitle(
    mode === "inspect" ? "Inspect body" : "Properties",
    mode === "inspect" ? "ruler" : "sliders-horizontal",
  );
  const dims = getBounds(b);
  $("#inspector").innerHTML =
    `<div class="eyebrow">${b ? "SOLID BODY" : "YOUR WORKSPACE"}</div><h2>${esc(b?.name || "Make something real.")}</h2><p class="subtitle">${b ? "Precision geometry. Ready for your next idea." : "Start with a sketch, a primitive, or a STEP file."}</p>${b ? `<div class="sectionlabel">Dimensions</div><div class="property"><span>Width · X</span><strong>${dim(dims[0])} mm</strong></div><div class="property"><span>Depth · Y</span><strong>${dim(dims[1])} mm</strong></div><div class="property"><span>Height · Z</span><strong>${dim(dims[2])} mm</strong></div><div class="sectionlabel">Physical properties</div><div class="property"><span>Volume</span><strong>${dim((b.volume || 0) / 1000)} cm³</strong></div><div class="property"><span>Surface area</span><strong>${dim((b.area || 0) / 100)} cm²</strong></div><div class="sectionlabel">Appearance</div><div class="material"><div class="material-ball"></div><span>Satin titanium<small>Display finish · no material assigned</small></span></div><div class="inline-buttons"><button class="btn" data-tool="transform">${ico("move-3d")}Move</button><button class="btn" data-action="fit">${ico("scan")}Fit view</button></div><div class="infobox"><strong>Built to be changed</strong>Select a feature in the browser or history to edit its dimensions. Every later feature rebuilds from your changes.</div>` : `<button class="btn primary" data-action="sketch">${ico("pencil-ruler")}Create a sketch</button><div class="infobox"><strong>A familiar starting point</strong>Open the original knife profile, a mounting plate, or a printable enclosure from the example designs.</div><div class="inline-buttons"><button class="btn" data-action="examples">${ico("layout-grid")}Example designs</button></div>`}`;
  iconize();
}
function beginFeature(type) {
  activeMenu = null;
  if (!ready || busy) return;
  if (sketch) {
    toast("Finish or cancel your sketch first.");
    return;
  }
  const def = definitions[type];
  if (def.target && !selectedBody()) {
    toast("Create or import a body first.");
    return;
  }
  setPanel(true);
  mode = "model";
  selectedFeature = null;
  draft = {
    id: uid(),
    type,
    name: `${def.label} ${doc.features.filter((f) => f.type === type).length + 1}`,
    params: Object.fromEntries(def.fields.map(([n, l, v]) => [n, v])),
    isNew: true,
  };
  if (def.target) draft.params.targetId = selectedBody().id;
  if (type === "extrude")
    Object.assign(draft.params, {
      profile: "rect",
      width: 40,
      depth: 30,
      plane: "XY",
    });
  if (["fillet", "chamfer"].includes(type)) draft.params.edges = "vertical";
  if (type === "mirror") draft.params.plane = "YZ";
  if (type === "linearPattern") draft.params.axis = "X";
  if (type === "boolean") {
    draft.params.operation = "union";
    draft.params.toolId =
      result.bodies.find((b) => b.id !== draft.params.targetId)?.id || "";
  }
  drawFeatureForm();
  drawRibbon();
  drawTree();
}
function editFeature(id) {
  activeMenu = null;
  setPanel(true);
  if (busy || sketch) return;
  const f = doc.features.find((f) => f.id === id);
  if (!f) return;
  selectedFeature = id;
  selected = f.params.targetId || f.id;
  viewport.select(selected);
  draft = { ...clone(f), isNew: false };
  drawFeatureForm();
  drawTree();
  drawRibbon();
  updatePill();
}
function drawFeatureForm() {
  const d = definitions[draft.type];
  setInspectorTitle(draft.isNew ? "New feature" : "Edit feature", d.icon);
  let extra = "";
  const p = draft.params;
  if (d.target)
    extra += field(
      "targetId",
      "Body",
      p.targetId,
      "",
      availableBodies().map((b) => [b.id, b.name]),
    );
  if (draft.type === "extrude") {
    extra += field(
      "profile",
      "Profile",
      typeof p.profile === "string" ? p.profile : "polygon",
      "",
      [
        ["rect", "Rectangle"],
        ["circle", "Circle"],
        ["polygon", "Sketch profile"],
      ],
    );
    extra += field("plane", "Sketch plane", p.plane || "XY", "", [
      "XY",
      "XZ",
      "YZ",
    ]);
    if (p.profile === "rect") {
      extra +=
        field("width", "Width", p.width || 40) +
        field("depth", "Depth", p.depth || 30);
    } else if (p.profile === "circle")
      extra += field("radius", "Radius", p.radius || 15);
    else
      extra += `<div class="infobox"><strong>Closed sketch</strong>${p.points?.length || 0} vertices. ${p.points?.length ? "Dimensions are stored with the sketch." : "Use New sketch to draw your profile."}</div>`;
  }
  if (["fillet", "chamfer"].includes(draft.type))
    extra +=
      field("edgeTreatment", "Treatment", draft.type, "", [
        ["fillet", "Fillet"],
        ["chamfer", "Chamfer"],
      ]) +
      field("edges", "Edges", p.edges || "vertical", "", [
        ["vertical", "Vertical edges"],
        ["all", "All edges"],
      ]);
  if (draft.type === "mirror")
    extra += field("plane", "Mirror plane", p.plane || "YZ", "", [
      "YZ",
      "XZ",
      "XY",
    ]);
  if (draft.type === "linearPattern")
    extra += field("axis", "Direction", p.axis || "X", "", ["X", "Y", "Z"]);
  if (draft.type === "boolean") {
    extra +=
      field("operation", "Operation", p.operation || "union", "", [
        ["union", "Join"],
        ["cut", "Subtract"],
        ["intersect", "Intersect"],
      ]) +
      field(
        "toolId",
        "Tool body",
        p.toolId,
        "",
        availableBodies()
          .filter((b) => b.id !== p.targetId)
          .map((b) => [b.id, b.name]),
      );
  }
  const r = result.features.find((f) => f.id === draft.id);
  $("#inspector").innerHTML =
    `<div class="eyebrow">${d.group || "FEATURE"}</div><h2>${d.label}</h2><p class="subtitle">${esc(d.description || "Imported boundary representation solid.")}</p><form id="feature-form"><label class="field"><span>Feature name</span><input name="featureName" value="${esc(draft.name)}" maxlength="70" required></label>${extra}${d.fields.map(([n, l, v, u]) => field(n, l, p[n] ?? v, u ?? "mm")).join("")}${r?.error ? `<div class="infobox errorbox"><strong>Rebuild needs attention</strong>${esc(r.error)}</div>` : ""}<div class="actionbar"><button class="btn" type="button" data-action="cancel-feature">Cancel</button><button class="btn primary" type="submit" ${busy ? "disabled" : ""}>${ico("check")}${draft.isNew ? "Create" : "Apply"}</button></div></form>${!draft.isNew ? `<div class="sectionlabel">Feature controls</div><div class="inline-buttons"><button class="btn" data-action="suppress">${ico(draft.suppressed ? "play" : "pause")}${draft.suppressed ? "Enable" : "Suppress"}</button><button class="btn danger" data-action="delete-feature">${ico("trash-2")}Delete</button></div><p class="smalltext">Removing or suppressing a source can prevent dependent features from rebuilding.</p>` : ""}`;
  iconize();
  $("#feature-form").onsubmit = applyFeature;
  $("#feature-form").onchange = (e) => {
    if (
      [
        "profile",
        "plane",
        "edges",
        "targetId",
        "operation",
        "edgeTreatment",
      ].includes(e.target.name)
    ) {
      readDraft();
      drawFeatureForm();
    }
  };
}
function readDraft() {
  const data = new FormData($("#feature-form"));
  for (const [key, val] of data) {
    if (key === "edgeTreatment") {
      if (["fillet", "chamfer"].includes(val)) draft.type = val;
    } else if (key === "featureName") draft.name = val;
    else
      draft.params[key] = [
        "profile",
        "plane",
        "edges",
        "targetId",
        "toolId",
        "operation",
        "axis",
      ].includes(key)
        ? val
        : Number(val);
  }
}
async function applyFeature(e) {
  e.preventDefault();
  if (busy) return;
  readDraft();
  const f = clone(draft);
  delete f.isNew;
  snapshot();
  if (draft.isNew) doc.features.push(f);
  else doc.features = doc.features.map((x) => (x.id === f.id ? f : x));
  selectedFeature = f.id;
  selected = f.params.targetId || f.id;
  draft = null;
  await rebuild();
  if (result.features.find((r) => r.id === f.id)?.status === "error")
    editFeature(f.id);
}
async function rebuild(fit = false) {
  busy = true;
  $("#loader").classList.remove("hidden");
  $("#load-text").textContent = ready
    ? "Rebuilding your design"
    : "Starting the modeling engine";
  status("Computing solid geometry…");
  await new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(r)),
  );
  try {
    const next = await buildModel(doc.features, doc.imports);
    result = next;
    viewport.setBodies(result.bodies);
    for (const [id, v] of visible) if (!v) viewport.setVisible?.(id, false);
    if (selected && !result.bodies.some((b) => b.id === selected))
      selected = result.bodies[0]?.id || null;
    viewport.select(selected);
    if (fit) viewport.fit();
    const failures = result.features.filter(
      (f) => f.status === "error" || f.status === "blocked",
    );
    status(
      failures.length
        ? `${failures.length} feature${failures.length > 1 ? "s" : ""} need attention · select the feature to inspect`
        : "Design up to date",
    );
    saveLocal();
  } catch (e) {
    toast("Could not rebuild: " + (e.message || e));
    status("Rebuild failed");
  } finally {
    busy = false;
    $("#loader").classList.add("hidden");
    drawTree();
    drawInspector();
    updatePill();
    updateDocName();
    drawRibbon();
  }
}
function loadExample(name) {
  if (!ready || busy) return;
  snapshot();
  doc.features = [];
  doc.imports = {};
  visible.clear();
  selectedFeature = null;
  draft = null;
  const add = (type, name, params) => {
    let f = { id: uid(), type, name, params };
    doc.features.push(f);
    return f.id;
  };
  if (name === "plate") {
    doc.name = "Mounting plate";
    let id = add("box", "Plate blank", { width: 96, depth: 64, height: 12 });
    add("fillet", "Corner radius · 6 mm", {
      targetId: id,
      radius: 6,
      edges: "vertical",
    });
    for (const [i, [x, y]] of [
      [-32, -20],
      [32, -20],
      [32, 20],
      [-32, 20],
    ].entries())
      add("hole", `Mounting hole ${i + 1}`, { targetId: id, radius: 4, x, y });
    selected = id;
  } else if (name === "knife") {
    doc.name = "Knife blade · original";
    selected = add("extrude", "Original knife profile", {
      profile: "polygon",
      points: knife,
      height: 4,
      plane: "XY",
    });
  } else if (name === "enclosure") {
    doc.name = "Project enclosure";
    let id = add("box", "Enclosure blank", {
      width: 80,
      depth: 55,
      height: 28,
    });
    add("fillet", "Rounded corners", {
      targetId: id,
      radius: 5,
      edges: "vertical",
    });
    add("shell", "Open enclosure · 2 mm", { targetId: id, thickness: 2 });
    selected = id;
  } else {
    doc.name = "Untitled design";
    selected = null;
  }
  mode = "model";
  activeMenu = null;
  setPanel(false);
  selectedIds.clear();
  drawMode();
  closeModal();
  rebuild(true);
}
async function history(direction) {
  if (busy || sketch) return;
  const from = direction === "undo" ? undoStack : redoStack,
    to = direction === "undo" ? redoStack : undoStack;
  if (!from.length) return;
  to.push(clone(doc));
  doc = from.pop();
  draft = null;
  selectedFeature = null;
  await rebuild();
}
function download(data, name, type) {
  const blob =
    data instanceof Blob
      ? data
      : new Blob([data], { type: type || "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
function filename() {
  return doc.name.replace(/[^a-zA-Z0-9 _-]/g, "").trim() || "The Forge design";
}
function saveProject() {
  saveLocal();
  download(
    JSON.stringify(doc, null, 2),
    filename() + ".forge",
    "application/json",
  );
  toast("Editable The Forge project saved.");
}
function modal(html, wide = false) {
  $("#modal-root").innerHTML =
    `<div class="modal-shade"><section role="dialog" aria-modal="true" class="modal ${wide ? "wide" : ""}">${html}</section></div>`;
  iconize();
  $("#modal-root .modal-shade").onclick = (e) => {
    if (e.target === e.currentTarget) closeModal();
  };
}
function closeModal() {
  $("#modal-root").innerHTML = "";
}
function modalHead(title) {
  return `<div class="modalhead"><h2>${title}</h2><button class="iconbutton" data-action="close-modal" aria-label="Close">${ico("x")}</button></div>`;
}
function examples() {
  modal(
    modalHead("What will you make?") +
      '<p>Start fresh or explore an editable design. Your current project stays in Undo.</p><div class="modalgrid">' +
      [
        ["empty", "file-plus-2", "New design", "A clean workspace"],
        ["plate", "component", "Mounting plate", "Fillets and through holes"],
        [
          "enclosure",
          "package-open",
          "Project enclosure",
          "A hollow, rounded case",
        ],
        [
          "knife",
          "spline",
          "Your original knife",
          "Imported from Forge Sculpt",
        ],
      ]
        .map(
          ([id, icon, title, sub]) =>
            `<button class="examplecard" data-example="${id}">${ico(icon)}<strong>${title}</strong><small>${sub}</small></button>`,
        )
        .join("") +
      "</div>",
  );
}
function exportDialog() {
  if (!result.bodies.length) {
    toast("Create a solid before exporting.");
    return;
  }
  modal(
    modalHead("From idea to object.") +
      `<p>Export all visible solid bodies. Hidden bodies are excluded. STL uses millimeter coordinates; select millimeters when importing into your slicer.</p><div class="modalgrid"><button class="examplecard" data-action="export-stl">${ico("printer")}<strong>STL · 3D printing</strong><small>Fine mesh · 0.05 mm tolerance</small></button><button class="examplecard" data-action="export-step">${ico("box")}<strong>STEP · Editable solids</strong><small>Exact boundary geometry</small></button></div><button class="btn" data-action="save" aria-label="Save">${ico("save")}Save editable The Forge project</button><p class="smalltext">Supports STL and STEP. Printer toolpaths and G-code are generated in your preferred slicer.</p>`,
  );
}
async function exportFile(format) {
  if (!ready || busy) return;
  const bodies = result.bodies.filter((b) => visible.get(b.id) !== false);
  if (!bodies.length) {
    toast("There are no visible bodies to export.");
    return;
  }
  if (
    result.features.some((f) => f.status === "error" || f.status === "blocked")
  ) {
    toast("Resolve or suppress failed features before exporting.");
    return;
  }
  status(`Preparing ${format.toUpperCase()}…`);
  try {
    const blob = await (format === "stl"
      ? exportSTL(bodies)
      : exportSTEP(bodies));
    download(blob, filename() + "." + format);
    closeModal();
    toast(
      `${format.toUpperCase()} exported · ${bodies.length} solid ${bodies.length === 1 ? "body" : "bodies"}`,
    );
    status("Design up to date");
  } catch (e) {
    toast("Export failed: " + e.message);
    status("Export failed");
  }
}
async function openFile(file) {
  if (!file) return;
  if (file.size > 50 * 1024 * 1024) {
    toast("Use a file smaller than 50 MB in this version.");
    return;
  }
  try {
    if (/\.(step|stp)$/i.test(file.name)) {
      const text = await file.text();
      const key = uid();
      snapshot();
      doc.imports[key] = text;
      const id = uid();
      doc.features.push({
        id,
        type: "imported",
        name: file.name.replace(/\.[^.]+$/, ""),
        params: { importId: key },
      });
      selected = id;
      await rebuild(true);
    } else {
      const incoming = JSON.parse(await file.text());
      if (!validDocument(incoming))
        throw Error("This is not a supported The Forge project.");
      snapshot();
      doc = incoming;
      doc.printer ||= {
        name: "Custom printer",
        width: 256,
        depth: 256,
        height: 256,
      };
      doc.imports ||= {};
      draft = null;
      await rebuild(true);
    }
    toast("Design opened.");
  } catch (e) {
    toast("Could not open file: " + e.message);
  }
}
function drawMode() {
  document
    .querySelectorAll("[data-mode]")
    .forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
  drawRibbon();
  drawInspector();
}
function switchMode(m) {
  activeMenu = null;
  if (m === mode && !sketch) {
    mode = "model";
    viewport.setBed?.(null);
    setPanel(false);
    drawMode();
    return;
  }
  setPanel(m !== "model");
  if (sketch && m !== "sketch") {
    toast("Finish or cancel your sketch first.");
    return;
  }
  mode = m;
  draft = null;
  drawMode();
  if (m === "sketch" && !sketch) startSketch();
  if (m === "print") viewport.setBed?.(doc.printer);
  else viewport.setBed?.(null);
}
function drawPrint() {
  setInspectorTitle("Print preparation", "printer");
  const b = selectedBody(),
    dims = getBounds(b),
    p = doc.printer;
  let bodies = result.bodies.filter((b) => visible.get(b.id) !== false);
  let fit =
    bodies.length > 0 &&
    bodies.every((b) => {
      const d = getBounds(b);
      return (
        d[0] <= p.width + 0.001 &&
        d[1] <= p.depth + 0.001 &&
        d[2] <= p.height + 0.001
      );
    });
  $("#inspector").innerHTML =
    `<div class="eyebrow">DESIGNED FOR MAKING</div><h2>Ready for the real world.</h2><p class="subtitle">Check your part, set your build volume, and send it to your slicer.</p><form id="printer-form"><label class="field"><span>Printer profile</span><select name="preset"><option value="custom">Custom build volume</option><option value="256" ${p.width === 256 && p.depth === 256 && p.height === 256 ? "selected" : ""}>256 × 256 × 256 mm</option><option value="220" ${p.width === 220 ? "selected" : ""}>220 × 220 × 250 mm</option><option value="180">180 × 180 × 180 mm</option></select></label>${field("width", "Bed width · X", p.width)}${field("depth", "Bed depth · Y", p.depth)}${field("height", "Build height · Z", p.height)}<button class="btn" type="submit">Update build volume</button></form><div class="sectionlabel">Part checks</div><div class="property"><span>Individual part fit</span><strong style="color:${fit ? "#438673" : "#b47841"}">${bodies.length ? (fit ? "Within volume" : "Exceeds volume") : "No bodies"}</strong></div><div class="property"><span>Model units</span><strong>Millimeters</strong></div><div class="property"><span>Visible bodies</span><strong>${bodies.length}</strong></div><div class="property"><span>Selected size</span><strong>${dims.map(dim).join(" × ")}</strong></div><div class="inline-buttons"><button class="btn" data-action="orient">${ico("move-down")}Place on bed</button></div><button class="btn primary" data-action="export-stl" style="width:100%">${ico("upload")}Export STL for printing</button><div class="infobox"><strong>Finish in your slicer</strong>Fit checks compare each part’s dimensions with your printer’s volume. Arrange multiple parts and check walls, supports, overhangs, infill, and print settings in your slicer.</div>`;
  iconize();
  $("#printer-form").onsubmit = (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const p = {
      name: "Custom printer",
      width: +data.get("width"),
      depth: +data.get("depth"),
      height: +data.get("height"),
    };
    if (
      Object.values(p)
        .slice(1)
        .some((v) => !Number.isFinite(v) || v <= 0)
    )
      return;
    snapshot();
    doc.printer = p;
    saveLocal();
    viewport.setBed?.(p);
    drawPrint();
    drawTree();
  };
  $("#printer-form select").onchange = (e) => {
    if (e.target.value !== "custom") {
      const v = +e.target.value;
      for (const [n, x] of [
        ["width", v],
        ["depth", v],
        ["height", v === 220 ? 250 : v],
      ])
        $('#printer-form [name="' + n + '"]').value = x;
    }
  };
}
async function placeOnBed() {
  const b = selectedBody();
  if (!b) return;
  let min = b.bounds?.min || b.bounds?.[0];
  let max = b.bounds?.max || b.bounds?.[1];
  if (!min || !max) {
    toast("Select a body to position.");
    return;
  }
  snapshot();
  doc.features.push({
    id: uid(),
    type: "transform",
    name: "Place on print bed",
    params: {
      targetId: b.id,
      x: -(min[0] + max[0]) / 2,
      y: -(min[1] + max[1]) / 2,
      z: -min[2],
      rx: 0,
      ry: 0,
      rz: 0,
    },
  });
  await rebuild(true);
}
function commands() {
  modal(
    modalHead("Find a command") +
      '<label class="field"><input id="command-search" placeholder="Search modeling tools…" autofocus></label><div id="command-results"></div>',
  );
  let commandIndex = 0;
  const highlight = () =>
    document
      .querySelectorAll(".commandresult")
      .forEach((b, i) => b.classList.toggle("focused", i === commandIndex));
  const render = (q) => {
    commandIndex = 0;
    $("#command-results").innerHTML = Object.entries(definitions)
      .filter(
        ([k, v]) =>
          k !== "imported" && v.label.toLowerCase().includes(q.toLowerCase()),
      )
      .map(
        ([key, v]) =>
          `<button class="commandresult" data-command="${key}">${ico(v.icon)}${v.label}<span class="spacer"></span><span class="smalltext">${v.group}</span></button>`,
      )
      .join("");
    iconize();
    highlight();
  };
  render("");
  $("#command-search").oninput = (e) => render(e.target.value);
  $("#command-search").onkeydown = (e) => {
    const list = [...document.querySelectorAll(".commandresult")];
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      commandIndex =
        (commandIndex + (e.key === "ArrowDown" ? 1 : -1) + list.length) %
        Math.max(1, list.length);
      highlight();
      list[commandIndex]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      list[commandIndex]?.click();
    }
  };
  $("#command-search").focus();
}
function help() {
  modal(
    modalHead("Keyboard shortcuts") +
      `<p>Shapr3D Windows hotkeys for supported tools. Click outside a text field before using a single-key command.</p><div class="shortcut-columns">${shortcuts.map(([key, name]) => `<div class="help-row"><span>${name}</span><kbd class="shortcut">${key}</kbd></div>`).join("")}</div><div class="infobox"><strong>Mouse navigation</strong>Right-drag to orbit. Middle-drag or Shift + right-drag to pan. Scroll to zoom.</div><details class="shortcut-gaps"><summary>Commands not yet implemented</summary>${unavailable.map(([key, name]) => `<div class="help-row"><span>${name}</span><kbd class="shortcut">${key}</kbd></div>`).join("")}<p>Assemblies, drawings, general constraints, and manufacturing toolpaths are not part of this build. Browser-reserved shortcuts depend on the host delivering the key event to this app.</p></details><p class="smalltext">Reference: <a target="_blank" rel="noreferrer" href="https://support.shapr3d.com/hc/en-us/articles/7873906073884-Keyboard-shortcuts-gestures-and-hotkeys">Shapr3D’s official shortcut guide</a>.</p>`,
    true,
  );
}

// Sketches use model coordinates in millimeters; the drawing is stored as editable feature data.
function startSketch() {
  if (!ready || busy || sketch) return;
  mode = "sketch";
  activeMenu = null;
  setPanel(true);
  draft = null;
  sketch = {
    tool: "rect",
    points: [],
    start: null,
    current: null,
    profile: null,
    plane: "XY",
    snap: 1,
    scale: 4,
  };
  const host = document.createElement("div");
  host.className = "sketch-area";
  host.id = "sketch-area";
  host.innerHTML =
    '<svg id="sketch-svg" aria-label="Sketch drawing area"></svg>';
  $(".viewport-wrap").append(host);
  host.addEventListener("pointerdown", sketchDown);
  host.addEventListener("pointermove", sketchMove);
  host.addEventListener("dblclick", finishPolygon);
  drawMode();
  renderSketch();
}
function sketchCoords(e) {
  const r = $("#sketch-area").getBoundingClientRect();
  const snap = sketch.snap || 0.1;
  return [
    Math.round((e.clientX - r.left - r.width / 2) / sketch.scale / snap) * snap,
    Math.round(-(e.clientY - r.top - r.height / 2) / sketch.scale / snap) *
      snap,
  ];
}
function sketchDown(e) {
  if (e.button !== 0) return;
  const p = sketchCoords(e);
  if (sketch.tool === "polygon") {
    if (
      sketch.points.length >= 3 &&
      Math.hypot(p[0] - sketch.points[0][0], p[1] - sketch.points[0][1]) < 3
    ) {
      finishPolygon();
      return;
    }
    sketch.points.push(p);
    sketch.profile = null;
  } else if (!sketch.start) {
    sketch.start = p;
    sketch.profile = null;
  } else {
    const s = sketch.start;
    if (sketch.tool === "rect") {
      if (Math.abs(s[0] - p[0]) < 0.1 || Math.abs(s[1] - p[1]) < 0.1) return;
      sketch.profile = {
        type: "polygon",
        points: [
          [s[0], s[1]],
          [p[0], s[1]],
          [p[0], p[1]],
          [s[0], p[1]],
        ],
      };
    } else {
      const radius = Math.hypot(p[0] - s[0], p[1] - s[1]);
      if (radius < 0.1) return;
      sketch.profile =
        sketch.tool === "regular"
          ? { type: "polygon", points: regularPoints(s, p, sketch.sides || 6) }
          : { type: "circle", radius, center: s };
    }
    sketch.start = null;
  }
  sketch.current = p;
  renderSketch();
  drawSketchInspector();
}
function regularPoints(center, p, count) {
  const angle = Math.atan2(p[1] - center[1], p[0] - center[0]),
    radius = Math.hypot(p[0] - center[0], p[1] - center[1]);
  return Array.from({ length: count }, (_, i) => [
    center[0] + radius * Math.cos(angle + (i * Math.PI * 2) / count),
    center[1] + radius * Math.sin(angle + (i * Math.PI * 2) / count),
  ]);
}
function sketchMove(e) {
  if (!sketch) return;
  sketch.current = sketchCoords(e);
  renderSketch();
}
function finishPolygon() {
  if (sketch?.tool === "polygon" && sketch.points.length >= 3) {
    const pts = sketch.points.filter(
      (p, i, a) => !i || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1],
    );
    if (pts.length >= 3) {
      sketch.profile = { type: "polygon", points: pts };
      sketch.points = [];
      renderSketch();
      drawSketchInspector();
    }
  }
}
function renderSketch() {
  if (!sketch) return;
  const svg = $("#sketch-svg"),
    r = svg.getBoundingClientRect(),
    w = r.width,
    h = r.height,
    s = sketch.scale,
    cx = w / 2,
    cy = h / 2;
  const point = ([x, y]) => [cx + x * s, cy - y * s];
  const path = (pts) => pts.map((p) => point(p).join(",")).join(" ");
  let shape = "";
  if (sketch.profile?.type === "circle") {
    const [x, y] = point(sketch.profile.center);
    shape = `<circle cx="${x}" cy="${y}" r="${sketch.profile.radius * s}" fill="#4c95fa19" stroke="#4088e8" stroke-width="1.8"/>`;
  } else if (sketch.profile) {
    shape = `<polygon points="${path(sketch.profile.points)}" fill="#4c95fa19" stroke="#4088e8" stroke-width="1.8"/>`;
  } else if (sketch.start && sketch.current) {
    const a = sketch.start,
      b = sketch.current;
    if (sketch.tool === "rect")
      shape = `<polygon points="${path([a, [b[0], a[1]], b, [a[0], b[1]]])}" fill="#4c95fa0b" stroke="#4088e8" stroke-width="1.5"/>`;
    else if (sketch.tool === "regular")
      shape = `<polygon points="${path(regularPoints(a, b, sketch.sides || 6))}" fill="#4c95fa0b" stroke="#4088e8" stroke-width="1.5"/>`;
    else {
      const [x, y] = point(a);
      shape = `<circle cx="${x}" cy="${y}" r="${Math.hypot(b[0] - a[0], b[1] - a[1]) * s}" fill="#4c95fa0b" stroke="#4088e8" stroke-width="1.5"/>`;
    }
  } else if (sketch.points.length)
    shape = `<polyline points="${path([...sketch.points, ...(sketch.current ? [sketch.current] : [])])}" fill="none" stroke="#4088e8" stroke-width="1.8"/>`;
  const pts = sketch.profile?.points || sketch.points;
  shape += pts
    .map((p) => {
      let [x, y] = point(p);
      return `<circle cx="${x}" cy="${y}" r="3" fill="white" stroke="#4088e8" stroke-width="1.5"/>`;
    })
    .join("");
  svg.innerHTML = `<defs><pattern id="minorgrid" width="${s * 5}" height="${s * 5}" patternUnits="userSpaceOnUse" x="${cx}" y="${cy}"><path d="M ${s * 5} 0 L 0 0 0 ${s * 5}" fill="none" stroke="#dce5f0" stroke-width=".6"/></pattern><pattern id="majorgrid" width="${s * 25}" height="${s * 25}" patternUnits="userSpaceOnUse" x="${cx}" y="${cy}"><path d="M ${s * 25} 0 L 0 0 0 ${s * 25}" fill="none" stroke="#cad8e9" stroke-width=".8"/></pattern></defs><rect width="100%" height="100%" fill="url(#minorgrid)"/><rect width="100%" height="100%" fill="url(#majorgrid)"/><line x1="0" y1="${cy}" x2="${w}" y2="${cy}" stroke="#d8a5a0" stroke-width="1"/><line x1="${cx}" y1="0" x2="${cx}" y2="${h}" stroke="#a5c8b2" stroke-width="1"/>${shape}<circle cx="${cx}" cy="${cy}" r="3" fill="#9aaac0"/><text x="${cx + 8}" y="${cy + 15}" fill="#91a2b8" font-size="10">0</text><text x="20" y="28" fill="#738ca9" font-size="11" letter-spacing="1">${sketch.plane} PLANE · GRID 5 mm · SNAP ${sketch.snap} mm</text><text x="20" y="${h - 25}" fill="#8c9fb8" font-size="11">${sketch.current ? sketch.current.map((n) => n.toFixed(1)).join(", ") : "0, 0"} mm</text>`;
}
function drawSketchInspector() {
  setInspectorTitle("Sketch editor", "pencil-ruler");
  $("#inspector").innerHTML =
    `<div class="eyebrow">MAKE YOUR OUTLINE</div><h2>A shape of your own.</h2><p class="subtitle">${sketch.tool === "polygon" ? "Click to add corners. Click your first point or double-click to close." : sketch.tool === "rect" ? "Click two opposite corners to draw a rectangle." : sketch.tool === "regular" ? "Click the center, then a corner to size your polygon." : "Click the center, then a point on the circumference."}</p><div class="inline-buttons">${[
      ["rect", "rectangle-horizontal"],
      ["circle", "circle"],
      ["polygon", "pentagon"],
    ]
      .map(
        ([type, icon]) =>
          `<button class="btn ${sketch.tool === type ? "primary" : ""}" data-sketch-tool="${type}" title="${type}">${ico(icon)}</button>`,
      )
      .join(
        "",
      )}</div>${field("sketch-plane", "Plane", sketch.plane, "", ["XY", "XZ", "YZ"])}${field("sketch-snap", "Snap interval", sketch.snap)}${sketch.tool === "regular" ? field("sketch-sides", "Sides", sketch.sides || 6, "") : ""}<div class="property"><span>Profile</span><strong>${sketch.profile ? "Closed" : "Drawing"}</strong></div>${sketch.profile?.type === "circle" ? `<div class="property"><span>Radius</span><strong>${dim(sketch.profile.radius)} mm</strong></div>` : ""}<div class="actionbar"><button class="btn" data-action="cancel-sketch">Cancel</button><button class="btn primary" data-action="finish-sketch" ${!sketch.profile ? "disabled" : ""}>${ico("check")}Extrude</button></div><div class="inline-buttons"><button class="btn" data-action="clear-sketch">Clear outline</button></div><div class="infobox"><strong>Draw, then dimension</strong>Draw one closed profile per sketch. Set an exact extrusion depth in the next step. This sketcher supports snapping; general geometric constraints are not available yet.</div>`;
  iconize();
  if ($('[name="sketch-sides"]'))
    $('[name="sketch-sides"]').onchange = (e) => {
      sketch.sides = Math.round(
        Math.max(3, Math.min(64, Number(e.target.value) || 6)),
      );
      sketch.profile = null;
      renderSketch();
      drawSketchInspector();
    };
  $('[name="sketch-plane"]').onchange = (e) => {
    sketch.plane = e.target.value;
    renderSketch();
  };
  $('[name="sketch-snap"]').onchange = (e) => {
    sketch.snap = Math.max(0.1, Math.min(25, Number(e.target.value) || 1));
    renderSketch();
  };
}
function endSketch(commit) {
  if (!sketch) return;
  if (commit && !sketch.profile) {
    toast("Close the outline before extruding.");
    return;
  }
  const s = sketch;
  sketch = null;
  $("#sketch-area").remove();
  mode = "model";
  drawMode();
  if (commit) {
    beginFeature("extrude");
    const p = s.profile;
    if (p.type === "circle") {
      draft.params = {
        profile: "circle",
        radius: p.radius,
        center: p.center,
        plane: s.plane,
        height: 10,
      };
    } else
      draft.params = {
        profile: "polygon",
        points: p.points,
        plane: s.plane,
        height: 10,
      };
    drawFeatureForm();
  }
}
const actions = {
  "close-tools": () => {
    activeMenu = null;
    drawRibbon();
  },
  "toggle-items": toggleItems,
  "toggle-history": toggleHistory,
  "close-panel": () => {
    if (sketch) {
      endSketch(false);
    }
    draft = null;
    selectedFeature = null;
    mode = "model";
    setPanel(false);
    drawInspector();
    drawRibbon();
  },
  save: saveProject,
  open: () => $("#file-input").click(),
  export: exportDialog,
  "export-stl": () => exportFile("stl"),
  "export-step": () => exportFile("step"),
  examples,
  commands,
  help,
  "close-modal": closeModal,
  undo: () => history("undo"),
  redo: () => history("redo"),
  fit: () => viewport.fit(),
  grid: () => {
    viewport.toggleGrid();
    $("#grid-toggle").classList.toggle("active");
  },
  edges: () => {
    viewport.toggleEdges();
    $("#edges-toggle").classList.toggle("active");
  },
  section: () => {
    const enabled = !$("#section-toggle").classList.contains("active");
    viewport.setSection(enabled);
    $("#section-toggle").classList.toggle("active", enabled);
  },
  inspect: () => switchMode("inspect"),
  sketch: startSketch,
  "finish-sketch": () => endSketch(true),
  "cancel-sketch": () => endSketch(false),
  "clear-sketch": () => {
    if (sketch) {
      sketch.points = [];
      sketch.start = null;
      sketch.profile = null;
      renderSketch();
      drawSketchInspector();
    }
  },
  "cancel-feature": () => {
    draft = null;
    selectedFeature = null;
    drawInspector();
    drawTree();
    drawRibbon();
  },
  suppress: async () => {
    if (!draft) return;
    snapshot();
    const f = doc.features.find((f) => f.id === draft.id);
    f.suppressed = !f.suppressed;
    draft = null;
    selectedFeature = null;
    await rebuild();
  },
  "delete-feature": async () => {
    if (!draft) return;
    snapshot();
    doc.features = doc.features.filter((f) => f.id !== draft.id);
    draft = null;
    selectedFeature = null;
    await rebuild();
  },
  "print-settings": () => switchMode("print"),
  orient: placeOnBed,
};
app.addEventListener("click", (e) => {
  const b = e.target.closest("button,[data-body],[data-feature],[data-view]");
  if (!b) return;
  if (b.dataset.action) {
    if (busy && !["fit", "help", "close-modal"].includes(b.dataset.action))
      return;
    actions[b.dataset.action]?.();
  } else if (b.dataset.menu) openMenu(b.dataset.menu);
  else if (b.dataset.tool) beginFeature(b.dataset.tool);
  else if (b.dataset.mode) switchMode(b.dataset.mode);
  else if (b.dataset.visibility) {
    e.stopPropagation();
    const id = b.dataset.visibility;
    visible.set(id, visible.get(id) === false);
    viewport.setVisible?.(id, visible.get(id));
    drawTree();
  } else if (b.dataset.body) selectBody(b.dataset.body, e.shiftKey);
  else if (b.dataset.feature) editFeature(b.dataset.feature);
  else if (b.dataset.view) viewport.setView(b.dataset.view);
  else if (b.dataset.example) loadExample(b.dataset.example);
  else if (b.dataset.command) {
    closeModal();
    beginFeature(b.dataset.command);
  } else if (b.dataset.sketchTool) {
    if (!sketch) startSketch();
    if (sketch) {
      sketch.tool = b.dataset.sketchTool;
      sketch.start = null;
      sketch.profile = null;
      sketch.points = [];
      renderSketch();
      drawSketchInspector();
      drawRibbon();
    }
  }
});
$("#file-input").onchange = (e) => {
  openFile(e.target.files[0]);
  e.target.value = "";
};
$("#tree-search").oninput = (e) => {
  filter = e.target.value;
  drawTree();
};
$("#document-name").onchange = (e) => {
  snapshot();
  doc.name = e.target.value.trim() || "Untitled design";
  saveLocal();
  updateDocName();
};
window.addEventListener("keydown", (e) => {
  const typing =
    /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) ||
    document.activeElement?.isContentEditable;
  const key = keyAction(e, {
    typing,
    sketch: !!sketch,
    historySelected: !!selectedFeature,
    featureActive: !!draft,
  });
  if (!key) return;
  if ($("#modal-root").children.length) {
    if (key.action === "escape") {
      e.preventDefault();
      closeModal();
    }
    return;
  }
  e.preventDefault();
  if (busy) return;
  const { action, arg } = key;
  if (action === "tool") beginFeature(arg);
  else if (action === "boolean") {
    beginFeature("boolean");
    if (draft) {
      draft.params.operation = arg;
      drawFeatureForm();
    }
  } else if (action === "view") {
    viewport.setView(arg);
    if (arg === "iso") viewport.fit();
    status("View · " + arg);
  } else if (action === "items") toggleItems();
  else if (action === "history") toggleHistory();
  else if (action === "zoom-face") {
    if (!viewport.zoomToFace()) toast("Hover over a face, then press Space.");
  } else if (action === "select-all") {
    selectedFeature = null;
    draft = null;
    setPanel(false);
    selectedIds = new Set(
      result.bodies.filter((b) => visible.get(b.id) !== false).map((b) => b.id),
    );
    selected = [...selectedIds].at(-1) || null;
    viewport.select([...selectedIds]);
    drawTree();
    updatePill();
    status(selectedIds.size + " bodies selected");
  } else if (action === "deselect") {
    selectBody(null);
    setPanel(false);
  } else if (action === "sketch-tool") {
    if (!sketch) startSketch();
    if (sketch) {
      sketch.tool = arg;
      sketch.start = null;
      sketch.profile = null;
      sketch.points = [];
      renderSketch();
      drawSketchInspector();
      drawRibbon();
    }
  } else if (action === "sketch-back") {
    if (sketch.points.length) sketch.points.pop();
    else sketch.start = null;
    renderSketch();
  } else if (action === "finish-sketch") {
    if (sketch.tool === "polygon" && !sketch.profile) finishPolygon();
    endSketch(true);
  } else if (action === "apply") $("#feature-form")?.requestSubmit();
  else if (action === "escape") {
    if (activeMenu) {
      activeMenu = null;
      drawRibbon();
    } else if (sketch) {
      endSketch(false);
    } else {
      draft = null;
      selectedFeature = null;
      selectBody(null);
      mode = "model";
      setPanel(false);
      drawInspector();
    }
  } else if (action === "unavailable")
    toast(
      arg +
        " is not implemented in this build. Open Help for shortcut coverage.",
    );
  else if (action === "body-filter") status("Selection filter · Bodies");
  else if (action === "delete-body") deleteSelectedBodies();
  else actions[action]?.();
});
async function deleteSelectedBodies() {
  const ids = selectedIds.size ? [...selectedIds] : selected ? [selected] : [];
  if (!ids.length) return;
  snapshot();
  for (const targetId of ids)
    doc.features.push({
      id: uid(),
      type: "deleteBody",
      name: "Remove body",
      params: { targetId },
    });
  selectedIds.clear();
  selected = null;
  await rebuild();
}

window.addEventListener("resize", () => {
  if (sketch) renderSketch();
});
drawRibbon();
drawTree();
drawInspector();
updateDocName();
async function boot() {
  try {
    await initKernel();
    ready = true;
    $("#kernel-label").textContent = "OpenCascade · solid modeling";
    let restored = false;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE));
      if (validDocument(saved)) {
        doc = saved;
        doc.imports ||= {};
        doc.printer ||= {
          name: "Custom printer",
          width: 256,
          depth: 256,
          height: 256,
        };
        restored = true;
      }
    } catch {}
    if (restored) await rebuild(true);
    else loadExample("plate");
  } catch (e) {
    $("#load-text").textContent =
      "The geometry engine could not start: " + e.message;
    status("Engine startup failed");
    console.error(e);
  }
}
boot();
// Small read-only inspection surface for diagnostics; modeling flows use the interface above.
window.omniForge = {
  get document() {
    return clone(doc);
  },
  get model() {
    return result;
  },
  get ready() {
    return ready && !busy;
  },
  viewport,
};
