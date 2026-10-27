import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
const frontend = fileURLToPath(new URL("..", import.meta.url));
const crate = path.resolve(frontend, "../rust/sift");
const output = path.join(frontend, "public/sift");
execFileSync(
  "wasm-pack",
  [
    "build",
    crate,
    "--target",
    "web",
    "--release",
    "--out-dir",
    output,
    "--out-name",
    "camera_path_sift",
    "--no-default-features",
    "--features",
    "wasm",
    "--locked",
  ],
  {
    stdio: "inherit",
    env: { ...process.env, CARGO_PROFILE_RELEASE_OPT_LEVEL: "2" },
  },
);
