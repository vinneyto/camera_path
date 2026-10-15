import { defineConfig } from "orval";

export default defineConfig({
  cameraPath: {
    input: "../backend/openapi.json",
    output: {
      target: "packages/api/src/client/generated/client.ts",
      schemas: "packages/types/src/api",
      client: "react-query",
      httpClient: "fetch",
      mode: "single",
      override: {
        mutator: {
          path: "packages/api/src/client/orval-fetch.ts",
          name: "orvalFetch",
        },
      },
    },
  },
});
