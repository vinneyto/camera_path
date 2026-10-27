"use client";
import { Canvas } from "@react-three/fiber";
import { createRenderPipelineEvents } from "@camera-path/render-pipeline";
import { configureWebGlViewport } from "./configure-webgl-viewport";
import { SceneContents } from "./scene-contents";
import { SceneViewportFrame } from "./scene-viewport-frame";
import type { SceneViewportProps } from "./scene-viewport-types";

export function SceneViewport(props: SceneViewportProps) {
  const available = true;
  return (
    <SceneViewportFrame
      available={available}
      onScenePointerLeave={props.onScenePointerLeave}
      unavailableMessage="This renderer is unavailable in this browser"
      renderScene={(context) => (
        <Canvas
          events={createRenderPipelineEvents}
          onCreated={configureWebGlViewport}
          onPointerMissed={props.onScenePointerMissed}
          camera={{ far: 100, fov: 42, near: 0.01, position: [4, 3, 6] }}
          dpr={[1, 2]}
          gl={{ antialias: false }}
          shadows
          style={{
            backgroundColor: `rgb(${context.background
              .slice(0, 3)
              .map((c) => Math.round(c * 255))
              .join(" ")})`,
          }}
        >
          <SceneContents
            background={context.background}
            dark={context.dark}
            bottomInset={props.bottomOverlayHeight}
            depthSupported={false}
          />
        </Canvas>
      )}
    />
  );
}
