import type { ReactNode } from "react";

import type { Anchor, DepthOfFieldEffect, Vec3 } from "@/entities/project";
import type { CompiledTrajectory } from "@/entities/trajectory";
import type { SceneSurfaceBackground } from "@/shared/scene-surface";
import type { ContextMenuPosition } from "@/shared/ui";

export interface SceneViewportProps {
  anchors: Anchor[];
  bottomOverlayHeight?: number;
  deletingTrajectory: boolean;
  depthOfField?: DepthOfFieldEffect | null;
  pathPosition: number;
  selected: boolean;
  trajectory: CompiledTrajectory | null;
  onAddAnchor: (position: Vec3, normal: Vec3) => void;
  onDeleteAnchor: (anchor: Anchor) => void;
  onDeleteTrajectory: () => void;
  onSelectTrajectory: () => void;
  onUpdateAnchorLift: (anchorId: string, lift: number) => Promise<void>;
}

export interface SceneViewportRenderContext {
  background: SceneSurfaceBackground;
  dark: boolean;
  onOpenAnchorMenu: (anchor: Anchor, position: ContextMenuPosition) => void;
  onOpenTrajectoryMenu: (position: ContextMenuPosition) => void;
  onSurfaceError: (error: Error) => void;
  onSurfaceLoading: () => void;
  onSurfaceReady: () => void;
}

export interface SceneViewportFrameProps {
  available: boolean | null | undefined;
  onDeleteAnchor: (anchor: Anchor) => void;
  onDeleteTrajectory: () => void;
  deletingTrajectory: boolean;
  trajectoryAvailable: boolean;
  unavailableMessage?: string;
  renderScene: (context: SceneViewportRenderContext) => ReactNode;
}
