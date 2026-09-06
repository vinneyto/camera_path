"use client";

import { RenderPipelineCanvas } from "@/shared/three";

import { SceneViewportFrame } from "./scene-viewport-frame";
import { SceneWebGpuContents } from "./scene-webgpu-contents";
import type { SceneViewportProps } from "./scene-viewport-types";
import { useWebGpuAvailability } from "./use-webgpu-availability";

export function SceneWebGpuViewport(props: SceneViewportProps) {
  const webGpuAvailable = useWebGpuAvailability();

  return (
    <SceneViewportFrame
      available={webGpuAvailable}
      onDeleteAnchor={props.onDeleteAnchor}
      renderScene={(context) => (
        <RenderPipelineCanvas
          camera={{ far: 100, fov: 42, near: 0.01, position: [0, 0, 5] }}
          dpr={[1, 2]}
          flat
          shadows
          style={{
            backgroundColor: `rgb(${context.background.slice(0, 3)
              .map((channel) => Math.round(channel * 255)).join(" ")})`,
          }}
        >
          <SceneWebGpuContents context={context} {...props} />
        </RenderPipelineCanvas>
      )}
      unavailableMessage="WebGPU is unavailable in this browser"
    />
  );
}
