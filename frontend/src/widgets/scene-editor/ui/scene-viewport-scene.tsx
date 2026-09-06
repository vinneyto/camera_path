"use client";

import {
  SceneSurfaceProvider,
  type SceneSurfaceAdapter,
} from "@/shared/scene-surface";

import { SceneContents } from "./scene-contents";
import { useSceneViewportFrame } from "./scene-viewport-frame";
import type { SceneViewportProps } from "./scene-viewport-types";

interface SceneViewportSceneProps extends Omit<SceneViewportProps, "onDeleteAnchor"> {
  adapter: SceneSurfaceAdapter;
}

export function SceneViewportScene({ adapter, ...props }: SceneViewportSceneProps) {
  const frame = useSceneViewportFrame();

  return (
    <SceneSurfaceProvider adapter={adapter} background={frame.background}>
      <SceneContents
        anchors={props.anchors}
        dark={frame.dark}
        onAddAnchor={props.onAddAnchor}
        onOpenAnchorMenu={frame.onOpenAnchorMenu}
        onSelectTrajectory={props.onSelectTrajectory}
        onSurfaceError={frame.onSurfaceError}
        onSurfaceLoading={frame.onSurfaceLoading}
        onSurfaceReady={frame.onSurfaceReady}
        pathPosition={props.pathPosition}
        selected={props.selected}
        trajectory={props.trajectory}
      />
    </SceneSurfaceProvider>
  );
}
