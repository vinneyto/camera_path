"use client";

import { useMemo } from "react";

import {
  SceneSurfaceProvider,
  TileGaussianRenderingBackend,
} from "@/shared/scene-surface";
import { useRenderPipeline } from "@/shared/three";

import { SceneContents } from "./scene-contents";
import type {
  SceneViewportProps,
  SceneViewportRenderContext,
} from "./scene-viewport-types";

interface SceneWebGpuContentsProps extends SceneViewportProps {
  context: SceneViewportRenderContext;
}

export function SceneWebGpuContents({ context, ...props }: SceneWebGpuContentsProps) {
  const pipeline = useRenderPipeline();
  const backend = useMemo(() => new TileGaussianRenderingBackend(pipeline), [pipeline]);

  return (
    <SceneSurfaceProvider backend={backend}>
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
  );
}
