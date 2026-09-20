import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: {
        app: fileURLToPath(new URL("./index.html", import.meta.url)),
        purchase: fileURLToPath(new URL("./purchase.html", import.meta.url)),
      },
    },
  },
});
