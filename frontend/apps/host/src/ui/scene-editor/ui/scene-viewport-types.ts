import type { SceneSurfaceBackground } from "@camera-path/scene-runtime/surface";
import type { ReactNode } from "react";
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
