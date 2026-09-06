"use client";

import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { WebGLRenderer } from "three";

import {
  SceneSurfaceProvider,
  SparkGaussianRenderingBackend,
} from "@/shared/scene-surface";

import { SceneContents } from "./scene-contents";
import type {
  SceneViewportProps,
  SceneViewportRenderContext,
} from "./scene-viewport-types";

interface SceneSparkContentsProps extends SceneViewportProps {
  context: SceneViewportRenderContext;
}

export function SceneSparkContents({ context, ...props }: SceneSparkContentsProps) {
  const renderer = useThree((state) => state.gl);
  if (!(renderer instanceof WebGLRenderer)) {
    throw new TypeError("SparkGaussianRenderingBackend requires Three.js WebGLRenderer");
  }
  const backend = useMemo(
    () => new SparkGaussianRenderingBackend({ renderer }),
    [renderer],
  );
  useEffect(() => backend.setBackground(context.background), [backend, context.background]);

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
