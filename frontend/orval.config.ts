import { defineConfig } from "orval";

export default defineConfig({
  cameraPath: {
    input: "../backend/openapi.json",
    output: {
      target: "apps/host/src/adapters/api/generated/client.ts",
      schemas: "packages/contracts/src/api",
      client: "react-query",
      httpClient: "fetch",
      mode: "single",
      override: {
        mutator: {
          path: "apps/host/src/adapters/api/orval-fetch.ts",
          name: "orvalFetch",
        },
      },
    },
  },
});
