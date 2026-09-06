"use client";

import { SceneSurfaceProvider, tileSceneSurfaceAdapter } from "@/shared/scene-surface";
import { RenderPipelineCanvas } from "@/shared/three";

import { SceneContents } from "./scene-contents";
import { SceneViewportFrame } from "./scene-viewport-frame";
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
          shadows
        >
          <SceneSurfaceProvider adapter={tileSceneSurfaceAdapter} background={context.background}>
            <SceneContents
              anchors={props.anchors}
              dark={context.dark}
              onAddAnchor={props.onAddAnchor}
              onOpenAnchorMenu={context.onOpenAnchorMenu}
              onSelectTrajectory={props.onSelectTrajectory}
              onSurfaceError={context.onSurfaceError}
              onSurfaceLoading={context.onSurfaceLoading}
              onSurfaceReady={context.onSurfaceReady}
              pathPosition={props.pathPosition}
              selected={props.selected}
              trajectory={props.trajectory}
            />
          </SceneSurfaceProvider>
        </RenderPipelineCanvas>
      )}
      unavailableMessage="WebGPU is unavailable in this browser"
    />
  );
}
