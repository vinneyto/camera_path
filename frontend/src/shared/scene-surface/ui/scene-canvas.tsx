"use client";

import type { CanvasProps } from "@react-three/fiber";

import { RenderPipelineCanvas } from "@/shared/three";

import type { SceneSurfaceBackground } from "../model/scene-surface-types";
import { SceneSurfaceProvider } from "./scene-surface-provider";

export interface SceneCanvasProps extends Omit<CanvasProps, "gl"> {
  background: SceneSurfaceBackground;
}

export function SceneCanvas({ background, children, ...props }: SceneCanvasProps) {
  return (
    <RenderPipelineCanvas {...props}>
      <SceneSurfaceProvider background={background}>
        {children}
      </SceneSurfaceProvider>
    </RenderPipelineCanvas>
  );
}
