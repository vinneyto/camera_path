"use client";
import { RenderPipelineCanvas } from "@camera-path/scene-runtime/three";
import { SceneContents } from "./scene-contents";
import { SceneViewportFrame } from "./scene-viewport-frame";
import type { SceneViewportProps } from "./scene-viewport-types";
import { useWebGpuAvailability } from "./use-webgpu-availability";
export function SceneWebGpuViewport(props: SceneViewportProps) {
  const available = useWebGpuAvailability();
  return (
    <SceneViewportFrame
      available={available}
      onScenePointerLeave={props.onScenePointerLeave}
      unavailableMessage="WebGPU is unavailable in this browser"
      renderScene={(context) => (
        <RenderPipelineCanvas
          onPointerMissed={props.onScenePointerMissed}
          camera={{ far: 100, fov: 42, near: 0.01, position: [4, 3, 6] }}
          dpr={[1, 2]}
          flat
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
            depthSupported={true}
          />
        </RenderPipelineCanvas>
      )}
    />
  );
}
