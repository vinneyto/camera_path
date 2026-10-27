import { execFileSync, spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

/** Vercel's Node build image does not provide the Rust/WASM build toolchain. */
export async function prepareSiftToolchain() {
  const env = { ...process.env };
  if (!process.env.VERCEL) return env;
  const cargoBin = path.join(os.homedir(), ".cargo/bin");
  env.PATH = `${cargoBin}${path.delimiter}${env.PATH ?? ""}`;
  if (
    spawnSync("rustup", ["--version"], { env, stdio: "ignore" }).status !== 0
  ) {
    const response = await fetch("https://sh.rustup.rs");
    if (!response.ok)
      throw new Error(`Rust installer download failed: ${response.status}`);
    const installer = await response.text();
    execFileSync(
      "sh",
      [
        "-s",
        "--",
        "-y",
        "--profile",
        "minimal",
        "--default-toolchain",
        "stable",
        "--no-modify-path",
      ],
      { input: installer, env, stdio: ["pipe", "inherit", "inherit"] },
    );
  }
  execFileSync(
    "rustup",
    [
      "toolchain",
      "install",
      "stable",
      "--profile",
      "minimal",
      "--target",
      "wasm32-unknown-unknown",
    ],
    { env, stdio: "inherit" },
  );
  env.RUSTUP_TOOLCHAIN = "stable";
  if (
    spawnSync("wasm-pack", ["--version"], { env, stdio: "ignore" }).status !== 0
  ) {
    execFileSync(
      "cargo",
      ["install", "wasm-pack", "--version", "0.15.0", "--locked"],
      { env, stdio: "inherit" },
    );
  }
  return env;
}
