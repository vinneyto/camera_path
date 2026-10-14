import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    files: ["{src,apps,packages}/**/*.{ts,tsx}"],
    ignores: [
      "packages/scene-runtime/src/surface/adapters/3dgs-tile-webgpu/**",
      "packages/scene-runtime/src/surface/adapters/spark/**",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "3dgs-tile-webgpu",
              message:
                "Import 3dgs-tile-webgpu only inside its scene-surface adapter.",
            },
            {
              name: "@sparkjsdev/spark",
              message: "Import Spark only inside its scene-surface adapter.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "next-env.d.ts"]),
]);
