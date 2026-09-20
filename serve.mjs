import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";

const root = path.resolve(fileURLToPath(new URL("./dist/", import.meta.url)));
const port = 4173,
  url = `http://127.0.0.1:${port}/`;
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".wasm": "application/wasm",
  ".json": "application/json",
  ".svg": "image/svg+xml",
};
const open = () => {
  if (!process.argv.includes("--open")) return;
  if (process.platform === "win32")
    execFile("rundll32.exe", ["url.dll,FileProtocolHandler", url]);
  else if (process.platform === "darwin") execFile("open", [url]);
  else execFile("xdg-open", [url]);
};
const server = http.createServer(async (req, res) => {
  if (!["GET", "HEAD"].includes(req.method)) {
    res.writeHead(405);
    res.end();
    return;
  }
  if (req.url === "/__forge") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end('{"app":"The Forge","version":"0.1.0"}');
    return;
  }
  try {
    const pathname = decodeURIComponent(new URL(req.url, url).pathname);
    const file = path.resolve(
      root,
      "." + (pathname === "/" ? "/index.html" : pathname),
    );
    if (
      !file.startsWith(root + path.sep) &&
      file !== path.join(root, "index.html")
    ) {
      res.writeHead(403);
      res.end();
      return;
    }
    const info = await stat(file);
    if (!info.isFile()) throw Error("Not a file");
    res.writeHead(200, {
      "Content-Type": mime[path.extname(file)] || "application/octet-stream",
      "Content-Length": info.size,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": file.includes(path.sep + "assets" + path.sep)
        ? "public, max-age=31536000, immutable"
        : "no-cache",
    });
    if (req.method === "HEAD") res.end();
    else res.end(await readFile(file));
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("File not found. Build the application with npm run build.");
  }
});
server.on("error", async (e) => {
  if (e.code === "EADDRINUSE") {
    try {
      const response = await fetch(url + "__forge");
      const data = await response.json();
      if (data.app === "The Forge") {
        open();
        process.exit(0);
      }
    } catch {}
    console.error("Port 4173 is already in use by another application.");
  } else console.error(e.message);
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () => {
  console.log(`The Forge is running at ${url}`);
  open();
});
