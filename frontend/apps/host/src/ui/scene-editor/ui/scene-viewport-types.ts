import type { ReactNode } from "react";

import type { ProjectCloud } from "@camera-path/contracts/api";
import type { SceneSurfaceBackground } from "@camera-path/scene-runtime/surface";
import type { CompiledTrajectory } from "@camera-path/trajectory-math";
import type { ContextMenuPosition } from "@camera-path/ui-kit";
import type { Anchor, Vec3 } from "@host/adapters/project";

export interface SceneViewportProps {
  lidar?: import("@camera-path/contracts/api").LidarKeyframe | null;
  anchors: Anchor[];
  clouds: ProjectCloud[];
  initialCloudIds: string[] | null;
  bottomOverlayHeight?: number;
  deletingTrajectory: boolean;
  pathPosition: number;
  selected: boolean;
  trajectory: CompiledTrajectory | null;
  onAddAnchor: (position: Vec3, normal: Vec3) => void;
  onAddCloud: (assetId: string, position: Vec3) => Promise<boolean>;
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
  onSurfaceError: (cloudId: string, error: Error) => void;
  onSurfaceLoading: (cloudId: string) => void;
  onSurfaceReady: (cloudId: string) => void;
}

export interface SceneViewportFrameProps {
  available: boolean | null | undefined;
  onDeleteAnchor: (anchor: Anchor) => void;
  onDeleteTrajectory: () => void;
  deletingTrajectory: boolean;
  clouds: ProjectCloud[];
  trajectoryAvailable: boolean;
  unavailableMessage?: string;
  renderScene: (context: SceneViewportRenderContext) => ReactNode;
}
