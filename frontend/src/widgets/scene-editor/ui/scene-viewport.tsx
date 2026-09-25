"use client";

import { Canvas } from "@react-three/fiber";

import { CameraViewOffset } from "./camera-view-offset";
import { SceneContents } from "./scene-contents";
import { SceneViewportFrame } from "./scene-viewport-frame";
import type { SceneViewportProps } from "./scene-viewport-types";

export function SceneViewport(props: SceneViewportProps) {
  return (
    <SceneViewportFrame
      available
      clouds={props.clouds}
      deletingTrajectory={props.deletingTrajectory}
      onDeleteAnchor={props.onDeleteAnchor}
      onDeleteTrajectory={props.onDeleteTrajectory}
      trajectoryAvailable={Boolean(props.trajectory?.position_segments.length)}
      renderScene={(context) => (
        <Canvas
          camera={{ far: 100, fov: 42, near: 0.01, position: [0, 0, 5] }}
          dpr={[1, 2]}
          gl={{ antialias: false }}
          shadows
        >
          <CameraViewOffset bottomInset={props.bottomOverlayHeight ?? 0} />
          <SceneContents
            anchors={props.anchors}
            clouds={props.clouds}
            background={context.background}
            dark={context.dark}
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
        </Canvas>
      )}
    />
  );
}
