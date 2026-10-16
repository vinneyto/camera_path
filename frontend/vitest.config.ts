import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";
import tsconfig from "./tsconfig.json";
export default defineConfig({
  test: { exclude: [...configDefaults.exclude, "tools/module-map-viewer/**"] },
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
