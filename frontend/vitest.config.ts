import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import tsconfig from "./tsconfig.json";
export default defineConfig({
  resolve: {
    alias: Object.entries(tsconfig.compilerOptions.paths)
      .sort(([a], [b]) => b.length - a.length)
      .map(([key, [path]]) => ({
        find: new RegExp("^" + key.replace(/\*/g, "(.*)") + "$"),
        replacement: fileURLToPath(
          new URL(path.replace(/\*/g, "$1"), import.meta.url),
        ),
      })),
  },
});
