import type * as Api from "@/shared/api/generated/model";

// The editor composes a Project view from the separately fetched API resources.
// Required reflects values filled by Pydantic when serializing response models.
export type Vec3 = Api.Anchor["surface_position"];
export type Interpolation = Api.CameraKeyframeInterpolationToNext;
export type Anchor = Required<Api.Anchor>;
export type ScenePoint = Required<Api.ScenePoint>;
export type FollowPathAim = Required<Api.FollowPathAim>;
export type LookAtPointAim = Required<Api.LookAtPointAim>;
export type CameraAim = FollowPathAim | LookAtPointAim;
export type CameraOrientation = Required<Api.CameraOrientation>;
export type SpeedKeyframe = Required<Api.SpeedKeyframe>;
export type CameraKeyframe = Omit<Required<Api.CameraKeyframe>, "aim"> & {
  aim: CameraAim;
};
export type CameraOrientationKeyframe = Omit<
  Required<Api.CameraOrientationKeyframe>,
  "orientation"
> & { orientation: CameraOrientation };
export type CameraOrientationKeyframeCreate =
  Api.CameraOrientationKeyframeCreate;
export type CameraOrientationKeyframeUpdate =
  Api.CameraOrientationKeyframeUpdate;
export type CenterWeightedDepthOfFieldFocus =
  Api.CenterWeightedDepthOfFieldFocus;
export type ScenePointDepthOfFieldFocus =
  Required<Api.ScenePointDepthOfFieldFocus>;
export type DepthOfFieldFocus =
  CenterWeightedDepthOfFieldFocus | ScenePointDepthOfFieldFocus;
export type DepthOfFieldKeyframe = Omit<
  Required<Api.DepthOfFieldKeyframe>,
  "focus"
> & { focus: DepthOfFieldFocus };
export type DepthOfFieldKeyframeCreate = Api.DepthOfFieldKeyframeCreate;
export type DepthOfFieldKeyframeUpdate = Api.DepthOfFieldKeyframeUpdate;
export type ChatHistoryMessage = Required<Api.ChatHistoryMessage>;
export type AnchorCreate = Api.AnchorCreate;
export type AnchorUpdate = Api.AnchorUpdate;

export interface Project extends Api.ProjectMetadata {
  anchors: Record<string, Anchor>;
  scene_points: Record<string, ScenePoint>;
  segments: Array<Api.SplineSegment | Api.SpiralSegment>;
  camera_track: {
    default_aim: CameraAim;
    keyframes: Record<string, CameraKeyframe>;
    default_orientation: CameraOrientation;
    orientation_keyframes: Record<string, CameraOrientationKeyframe>;
    depth_of_field_keyframes: Record<string, DepthOfFieldKeyframe>;
    world_up: Vec3;
  };
  motion_profile: {
    default_speed: number;
    keyframes: Record<string, SpeedKeyframe>;
  };
  chat_history: ChatHistoryMessage[];
}
