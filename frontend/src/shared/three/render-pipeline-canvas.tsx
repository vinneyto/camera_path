"use client";

import { Canvas, type CanvasProps } from "@react-three/fiber";

import { createWebGpuRenderer } from "./create-webgpu-renderer";
import { RenderPipelineProvider } from "./render-pipeline-provider";

/** A WebGPU R3F Canvas whose frame output is owned by Three.js RenderPipeline. */
export function RenderPipelineCanvas({ children, ...props }: Omit<CanvasProps, "gl">) {
  return (
    <Canvas {...props} gl={createWebGpuRenderer}>
      <RenderPipelineProvider>{children}</RenderPipelineProvider>
    </Canvas>
  );
}
