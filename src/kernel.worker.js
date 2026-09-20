import {
  initKernel,
  buildModel,
  exportSTEP,
  exportSTL,
} from "./kernel-core.js";
let current = { bodies: [], features: [] };
let queue = Promise.resolve();
self.onmessage = ({ data }) => {
  queue = queue.then(async () => {
    const { id, action } = data;
    try {
      let result;
      if (action === "init") {
        await initKernel();
        result = true;
      } else if (action === "build") {
        current = await buildModel(data.features, data.imports);
        result = {
          ...current,
          bodies: current.bodies.map(({ shape, ...body }) => body),
        };
      } else if (action === "step" || action === "stl") {
        const bodies = current.bodies.filter((b) => data.ids.includes(b.id));
        result = action === "step" ? exportSTEP(bodies) : exportSTL(bodies);
      } else throw Error("Unknown geometry request.");
      self.postMessage({ id, result });
    } catch (e) {
      self.postMessage({ id, error: e.message || String(e) });
    }
  });
};
