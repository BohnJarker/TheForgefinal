// Browser computations stay off the UI thread; Node tests use the same core directly.
const inBrowser =
  typeof window !== "undefined" && typeof Worker !== "undefined";
let worker,
  pending = new Map(),
  sequence = 0,
  core;
const loadCore = () => (core ??= import("./kernel-core.js"));
function request(action, payload = {}) {
  if (!worker) {
    worker = new Worker(new URL("./kernel.worker.js", import.meta.url), {
      type: "module",
    });
    worker.onmessage = ({ data }) => {
      const item = pending.get(data.id);
      if (!item) return;
      pending.delete(data.id);
      if (data.error) item.reject(new Error(data.error));
      else item.resolve(data.result);
    };
    worker.onerror = (e) => {
      for (const item of pending.values())
        item.reject(
          new Error(
            e.message ||
              "The modeling worker stopped. Reload the app to recover.",
          ),
        );
      pending.clear();
    };
  }
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, action, ...payload });
  });
}
export const initKernel = (options) =>
  inBrowser ? request("init") : loadCore().then((c) => c.initKernel(options));
export const buildModel = (features, imports) =>
  inBrowser
    ? request("build", { features, imports })
    : loadCore().then((c) => c.buildModel(features, imports));
export const exportSTEP = (bodies) =>
  inBrowser
    ? request("step", { ids: bodies.map((b) => b.id) })
    : loadCore().then((c) => c.exportSTEP(bodies));
export const exportSTL = (bodies) =>
  inBrowser
    ? request("stl", { ids: bodies.map((b) => b.id) })
    : loadCore().then((c) => c.exportSTL(bodies));
export const importSTEP = (blob) => loadCore().then((c) => c.importSTEP(blob));
