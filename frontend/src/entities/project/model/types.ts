export type Vec3 = [number, number, number];
export type Interpolation = "smoothstep" | "linear" | "hold";

export interface Anchor {
  id: string;
  label: string;
  surface_position: Vec3;
  surface_normal: Vec3;
  lift: number;
  lift_axis: "world_up" | "surface_normal";
}

export interface ScenePoint {
  id: string;
  label: string;
  position: Vec3;
}

export interface FollowPathAim {
  kind: "follow_path";
  direction: "forward" | "backward";
}

export interface LookAtPointAim {
  kind: "look_at_point";
  scene_point_id: string;
}

export type CameraAim = FollowPathAim | LookAtPointAim;

export interface SpeedKeyframe {
  id: string;
  path_position: number;
  speed: number;
  interpolation_to_next: Interpolation;
}

export interface CameraKeyframe {
  id: string;
  path_position: number;
  aim: CameraAim;
  interpolation_to_next: Interpolation;
}

export interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface Project {
  id: string;
  name: string;
  revision: number;
  anchors: Record<string, Anchor>;
  scene_points: Record<string, ScenePoint>;
  segments: Array<{ id: string; kind: "spline" | "spiral" }>;
  camera_track: {
    default_aim: CameraAim;
    keyframes: Record<string, CameraKeyframe>;
    world_up: Vec3;
  };
  motion_profile: {
    default_speed: number;
    keyframes: Record<string, SpeedKeyframe>;
  };
  chat_history: ChatHistoryMessage[];
}

export interface AnchorCreate {
  label: string;
  surface_position: Vec3;
  surface_normal: Vec3;
  lift?: number;
  lift_axis?: "world_up" | "surface_normal";
}
