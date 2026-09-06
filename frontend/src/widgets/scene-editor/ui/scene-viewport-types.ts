import type { PropsWithChildren } from "react";

import type { Anchor, Vec3 } from "@/entities/project";
import type { CompiledTrajectory } from "@/entities/trajectory";
import type { SceneSurfaceBackground } from "@/shared/scene-surface";
import type { ContextMenuPosition } from "@/shared/ui";

export interface SceneViewportProps {
  anchors: Anchor[];
  pathPosition: number;
  selected: boolean;
  trajectory: CompiledTrajectory | null;
  onAddAnchor: (position: Vec3, normal: Vec3) => void;
  onDeleteAnchor: (anchor: Anchor) => void;
  onSelectTrajectory: () => void;
}

export interface SceneViewportFrameContextValue {
  background: SceneSurfaceBackground;
  dark: boolean;
  onOpenAnchorMenu: (anchor: Anchor, position: ContextMenuPosition) => void;
  onSurfaceError: (error: Error) => void;
  onSurfaceLoading: () => void;
  onSurfaceReady: () => void;
}

export interface SceneViewportFrameProps extends PropsWithChildren {
  available: boolean | null | undefined;
  onDeleteAnchor: (anchor: Anchor) => void;
  unavailableMessage?: string;
}
