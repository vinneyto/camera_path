import type { FollowPathAim, Interpolation, SpeedKeyframe, Vec3 } from "@/entities/project/model/types";

export interface ResolvedLookAtPointAim {
  kind: "look_at_point";
  scene_point_id: string;
  position: Vec3;
}

export type ResolvedCameraAim = FollowPathAim | ResolvedLookAtPointAim;

export interface CubicBezier3D {
  source_segment_id: string;
  p0: Vec3;
  p1: Vec3;
  p2: Vec3;
  p3: Vec3;
  length: number;
}

export interface CompiledCameraKeyframe {
  id: string;
  path_position: number;
  aim: ResolvedCameraAim;
  interpolation_to_next: Interpolation;
}

export interface CompiledTrajectory {
  project_id: string;
  revision: number;
  position_segments: CubicBezier3D[];
  arc_length_table: Array<{ segment_index: number; t: number; distance: number }>;
  total_length: number;
  duration_seconds: number;
  motion_profile: {
    default_speed: number;
    keyframes: SpeedKeyframe[];
  };
  camera_track: {
    default_aim: ResolvedCameraAim;
    keyframes: CompiledCameraKeyframe[];
    world_up: Vec3;
  };
  warnings: string[];
}

export interface ChatResult {
  answer: string;
  project: import("@/entities/project/model/types").Project;
  compiled: CompiledTrajectory;
}
