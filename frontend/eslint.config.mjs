import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/shared/scene-surface/adapters/3dgs-tile-webgpu/**",
      "src/shared/scene-surface/adapters/spark/**",
    ],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [
          {
            name: "3dgs-tile-webgpu",
            message: "Import 3dgs-tile-webgpu only inside its scene-surface adapter.",
          },
          {
            name: "@sparkjsdev/spark",
            message: "Import Spark only inside its scene-surface adapter.",
          },
        ],
      }],
    },
  },
  globalIgnores([".next/**", "out/**", "next-env.d.ts"]),
]);
