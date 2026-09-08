"use client";

import { RenderPipelineCanvas } from "@/shared/three";

import { CameraViewOffset } from "./camera-view-offset";
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
      trajectoryAvailable={Boolean(props.trajectory?.position_segments.length)}
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
          <CameraViewOffset bottomInset={props.bottomOverlayHeight ?? 0} />
          <SceneContents
            anchors={props.anchors}
            background={context.background}
            dark={context.dark}
            onAddAnchor={props.onAddAnchor}
            onOpenAnchorMenu={context.onOpenAnchorMenu}
            onSelectTrajectory={props.onSelectTrajectory}
            onSurfaceError={context.onSurfaceError}
            onSurfaceLoading={context.onSurfaceLoading}
            onSurfaceReady={context.onSurfaceReady}
            onUpdateAnchorLift={props.onUpdateAnchorLift}
            pathPosition={props.pathPosition}
            selected={props.selected}
            trajectory={props.trajectory}
          />
        </RenderPipelineCanvas>
      )}
      unavailableMessage="WebGPU is unavailable in this browser"
    />
  );
}
