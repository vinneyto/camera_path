"use client";

import { Canvas } from "@react-three/fiber";

import { SceneSparkContents } from "./scene-spark-contents";
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
          <SceneSparkContents context={context} {...props} />
        </Canvas>
      )}
    />
  );
}
