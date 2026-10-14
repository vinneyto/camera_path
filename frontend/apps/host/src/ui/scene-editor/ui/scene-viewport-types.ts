import type { ReactNode } from "react";
import type { SceneSurfaceBackground } from "@camera-path/scene-runtime/surface";
export interface SceneViewportProps {
  bottomOverlayHeight?: number;
  onScenePointerLeave?: () => void;
  onScenePointerMissed?: () => void;
}
export interface SceneViewportRenderContext {
  background: SceneSurfaceBackground;
  dark: boolean;
}
export interface SceneViewportFrameProps {
  onScenePointerLeave?: () => void;
  available: boolean | null | undefined;
  unavailableMessage?: string;
  renderScene: (context: SceneViewportRenderContext) => ReactNode;
}
