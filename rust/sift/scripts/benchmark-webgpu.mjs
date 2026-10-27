// node benchmark-webgpu.mjs /absolute/benchmark-directory [port]
// Directory contains frame.png and before/, batch/, after/ WASM packages.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(process.argv[2]);
const html = fileURLToPath(new URL("benchmark-webgpu.html", import.meta.url));
const port = Number(process.argv[3] ?? 3110);
const files = new Map([
  ["/", html],
  ["/frame.png", path.join(root, "frame.png")],
]);
for (const variant of [
  "before",
  "batch",
  "after",
  "gaussian",
  "compact",
  "sparse",
  "cpu",
]) {
  for (const file of ["camera_path_sift.js", "camera_path_sift_bg.wasm"]) {
    files.set(`/${variant}/${file}`, path.join(root, variant, file));
  }
}
http
  .createServer((request, response) => {
    const file = files.get(new URL(request.url, "http://localhost").pathname);
    if (!file || !fs.existsSync(file)) {
      response.writeHead(404).end();
      return;
    }
    response.setHeader("Cache-Control", "no-store");
    response.setHeader(
      "Content-Type",
      file.endsWith(".wasm")
        ? "application/wasm"
        : file.endsWith(".js")
          ? "text/javascript"
          : file.endsWith(".png")
            ? "image/png"
            : "text/html",
    );
    fs.createReadStream(file).pipe(response);
  })
  .listen(port, "127.0.0.1", () =>
    process.stdout.write(`WebGPU benchmark: http://localhost:${port}\n`),
  );
