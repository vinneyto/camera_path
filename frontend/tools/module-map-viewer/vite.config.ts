import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  // Keep the standalone viewer independent of the host's Tailwind/PostCSS setup.
  css: { postcss: { plugins: [] } },
  server: {
    fs: { allow: [fileURLToPath(new URL("../..", import.meta.url))] },
  },
});
