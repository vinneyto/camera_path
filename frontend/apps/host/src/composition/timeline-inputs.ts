import type { Project } from "@camera-path/contracts/project";
import type { CompiledTrajectory } from "@camera-path/contracts/trajectory";
export interface TimelineInputs {
  project: Project;
  trajectory: CompiledTrajectory;
  pathPosition: number;
  onScrub: (position: number) => void;
  deletingAimKeyframeId?: string;
  deletingOrientationKeyframeId?: string;
  deletingSpeedKeyframeId?: string;
  deletingDepthOfFieldKeyframeId?: string;
  onDeleteAimKeyframe: (id: string) => void;
  onDeleteOrientationKeyframe: (id: string) => void;
  onDeleteSpeedKeyframe: (id: string) => void;
  onDeleteDepthOfFieldKeyframe: (id: string) => void;
  onSetLidar?: (
    settings: import("@camera-path/contracts/api").LidarSettings | null,
  ) => void;
  effectsPending?: boolean;
  lidarPending?: boolean;
  onAddDepthOfField: () => void;
}
