import type { LidarKeyframe, LidarSettings } from "./api";
import type { Project } from "./project";
import type { CompiledTrajectory } from "./trajectory";
export interface AimTimelineInput {
  project: Pick<Project, "scene_points">;
  trajectory: {
    camera_track: Pick<
      CompiledTrajectory["camera_track"],
      "default_aim" | "keyframes"
    >;
  };
  deletingKeyframeId?: string;
  onDeleteKeyframe: (id: string) => void;
}
export interface OrientationTimelineInput {
  trajectory: {
    camera_track: Pick<
      CompiledTrajectory["camera_track"],
      "orientation_keyframes"
    >;
  };
  deletingKeyframeId?: string;
  onDeleteKeyframe: (id: string) => void;
}
export interface DepthOfFieldTimelineInput {
  project: Pick<Project, "scene_points">;
  trajectory: {
    camera_track: Pick<
      CompiledTrajectory["camera_track"],
      "depth_of_field_keyframes"
    >;
  };
  deletingKeyframeId?: string;
  onDeleteKeyframe: (id: string) => void;
  pending?: boolean;
  onAdd: () => void;
}
export interface LidarTimelineInput {
  keyframe: LidarKeyframe | null;
  onSet?: (settings: LidarSettings | null) => void;
  pending?: boolean;
}
export interface SpeedTimelineInput {
  trajectory: Pick<CompiledTrajectory, "motion_profile">;
  pathPosition: number;
  deletingKeyframeId?: string;
  onDeleteKeyframe: (id: string) => void;
}
export type PlaybackTrajectory = Pick<
  CompiledTrajectory,
  | "project_id"
  | "revision"
  | "total_length"
  | "duration_seconds"
  | "motion_profile"
>;
