import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  agentRules: false,
  ...(process.env.CAMERA_PATH_RENDERER_SOURCE
    ? {
        turbopack: {
          root: path.resolve(process.env.CAMERA_PATH_RENDERER_SOURCE, ".."),
        },
      }
    : {}),
  reactCompiler: true,
  reactStrictMode: true,
};

export default nextConfig;
