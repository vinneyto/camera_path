"use client";

import { tileSceneSurfaceAdapter } from "@/shared/scene-surface";
import { RenderPipelineCanvas } from "@/shared/three";

import { SceneViewportFrame } from "./scene-viewport-frame";
import { SceneViewportScene } from "./scene-viewport-scene";
import type { SceneViewportProps } from "./scene-viewport-types";
import { useWebGpuAvailability } from "./use-webgpu-availability";

export function SceneWebGpuViewport(props: SceneViewportProps) {
  const webGpuAvailable = useWebGpuAvailability();
  const { onDeleteAnchor, ...sceneProps } = props;

  return (
    <SceneViewportFrame
      available={webGpuAvailable}
      onDeleteAnchor={onDeleteAnchor}
      unavailableMessage="WebGPU is unavailable in this browser"
    >
      <RenderPipelineCanvas
        camera={{ far: 100, fov: 42, near: 0.01, position: [0, 0, 5] }}
        dpr={[1, 2]}
        shadows
      >
        <SceneViewportScene {...sceneProps} adapter={tileSceneSurfaceAdapter} />
      </RenderPipelineCanvas>
    </SceneViewportFrame>
  );
}
