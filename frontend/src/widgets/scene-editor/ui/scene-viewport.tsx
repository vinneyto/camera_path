"use client";

import { Canvas } from "@react-three/fiber";

import { SceneContents } from "./scene-contents";
import { SceneViewportFrame } from "./scene-viewport-frame";
import type { SceneViewportProps } from "./scene-viewport-types";

export function SceneViewport(props: SceneViewportProps) {
  return (
    <SceneViewportFrame
      available
      onDeleteAnchor={props.onDeleteAnchor}
      renderScene={(context) => (
        <Canvas
          camera={{ far: 100, fov: 42, near: 0.01, position: [0, 0, 5] }}
          dpr={[1, 2]}
          gl={{ antialias: false }}
          shadows
        >
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
        </Canvas>
      )}
    />
  );
}
