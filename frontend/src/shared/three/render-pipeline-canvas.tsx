"use client";

import { Canvas, type CanvasProps } from "@react-three/fiber";

import { configureInteractiveRaycasterLayers } from "./configure-interactive-raycaster-layers";
import { createRenderPipelineEvents } from "./create-render-pipeline-events";
import { createWebGpuRenderer } from "./create-webgpu-renderer";
import { RenderPipelineProvider } from "./render-pipeline-provider";

/** A WebGPU R3F Canvas whose frame output is owned by Three.js RenderPipeline. */
export function RenderPipelineCanvas({
  children,
  events = createRenderPipelineEvents,
  onCreated,
  ...props
}: Omit<CanvasProps, "gl">) {
  return (
    <Canvas
      {...props}
      events={events}
      gl={createWebGpuRenderer}
      onCreated={(state) => {
        configureInteractiveRaycasterLayers(state.raycaster);
        onCreated?.(state);
      }}
    >
      <RenderPipelineProvider>{children}</RenderPipelineProvider>
    </Canvas>
  );
}
