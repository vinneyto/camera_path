"use client";

import { Canvas } from "@react-three/fiber";

import { sparkSceneSurfaceAdapter } from "@/shared/scene-surface";

import { SceneViewportFrame } from "./scene-viewport-frame";
import { SceneViewportScene } from "./scene-viewport-scene";
import type { SceneViewportProps } from "./scene-viewport-types";

export function SceneViewport(props: SceneViewportProps) {
  const { onDeleteAnchor, ...sceneProps } = props;

  return (
    <SceneViewportFrame
      available
      onDeleteAnchor={onDeleteAnchor}
    >
      <Canvas
        camera={{ far: 100, fov: 42, near: 0.01, position: [0, 0, 5] }}
        dpr={[1, 2]}
        gl={{ antialias: false }}
        shadows
      >
        <SceneViewportScene {...sceneProps} adapter={sparkSceneSurfaceAdapter} />
      </Canvas>
    </SceneViewportFrame>
  );
}
