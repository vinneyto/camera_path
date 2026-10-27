// node profile-webgpu.mjs /absolute/artifact-directory [port]
// Directory contains frame.png and pkg/{camera_path_sift.js,camera_path_sift_bg.wasm}.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(process.argv[2]);
const port = Number(process.argv[3] ?? 3111);
const files = new Map(
  [
    ["/", "profile-webgpu.html"],
    ["/profile-worker.mjs", "profile-worker.mjs"],
    ["/webgpu-probe.mjs", "webgpu-probe.mjs"],
  ].map(([url, file]) => [url, fileURLToPath(new URL(file, import.meta.url))]),
);
files.set("/frame.png", path.join(root, "frame.png"));
for (const file of ["camera_path_sift.js", "camera_path_sift_bg.wasm"])
  files.set(`/pkg/${file}`, path.join(root, "pkg", file));
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
        : file.endsWith(".png")
          ? "image/png"
          : file.endsWith(".html")
            ? "text/html"
            : "text/javascript",
    );
    fs.createReadStream(file).pipe(response);
  })
  .listen(port, "127.0.0.1", () =>
    process.stdout.write(`SIFT profile: http://localhost:${port}\n`),
  );
