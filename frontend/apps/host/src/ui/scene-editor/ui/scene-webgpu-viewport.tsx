"use client";
import { RenderPipelineCanvas } from "@camera-path/scene-runtime/three";

import { CameraViewOffset } from "@camera-path/feature-camera-view";
import { SceneContents } from "@host/ui/scene-editor/ui/scene-contents";
import { SceneViewportFrame } from "@host/ui/scene-editor/ui/scene-viewport-frame";
import type { SceneViewportProps } from "@host/ui/scene-editor/ui/scene-viewport-types";
import { useWebGpuAvailability } from "@host/ui/scene-editor/ui/use-webgpu-availability";

export function SceneWebGpuViewport(props: SceneViewportProps) {
  const webGpuAvailable = useWebGpuAvailability();

  return (
    <SceneViewportFrame
      available={webGpuAvailable}
      clouds={props.clouds}
      deletingTrajectory={props.deletingTrajectory}
      onDeleteAnchor={props.onDeleteAnchor}
      onDeleteTrajectory={props.onDeleteTrajectory}
      trajectoryAvailable={Boolean(props.trajectory?.position_segments.length)}
      renderScene={(context) => (
        <RenderPipelineCanvas
          camera={{ far: 100, fov: 42, near: 0.01, position: [4, 3, 6] }}
          dpr={[1, 2]}
          flat
          shadows
          style={{
            backgroundColor: `rgb(${context.background
              .slice(0, 3)
              .map((channel) => Math.round(channel * 255))
              .join(" ")})`,
          }}
        >
          <CameraViewOffset bottomInset={props.bottomOverlayHeight ?? 0} />
          <SceneContents
            lidar={props.lidar}
            anchors={props.anchors}
            clouds={props.clouds}
            initialCloudIds={props.initialCloudIds}
            background={context.background}
            dark={context.dark}
            depthOfFieldSupported
            onAddAnchor={props.onAddAnchor}
            onAddCloud={props.onAddCloud}
            onOpenAnchorMenu={context.onOpenAnchorMenu}
            onOpenTrajectoryMenu={context.onOpenTrajectoryMenu}
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
