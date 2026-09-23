import type {
  CameraOrientation,
  CameraOrientationKeyframe,
  CenterWeightedDepthOfFieldFocus,
  FollowPathAim,
  SpeedKeyframe,
} from "@/entities/project/model/types";
import type * as Api from "@/shared/api/generated/model";

// The renderer expects the defaults which Pydantic includes in serialized responses.
export type ResolvedLookAtPointAim = Required<Api.ResolvedLookAtPointAim>;
export type ResolvedCameraAim = FollowPathAim | ResolvedLookAtPointAim;
export type ResolvedScenePointDepthOfFieldFocus =
  Required<Api.ResolvedScenePointDepthOfFieldFocus>;
export type ResolvedDepthOfFieldFocus =
  CenterWeightedDepthOfFieldFocus | ResolvedScenePointDepthOfFieldFocus;
export type CubicBezier3D = Api.CubicBezier3D;
export type CompiledDepthOfFieldKeyframe = Omit<
  Api.CompiledDepthOfFieldKeyframe,
  "focus"
> & { focus: ResolvedDepthOfFieldFocus };
export type CompiledCameraKeyframe = Omit<Api.CompiledCameraKeyframe, "aim"> & {
  aim: ResolvedCameraAim;
};
export type CompiledTrajectory = Omit<
  Required<Api.CompiledTrajectory>,
  "camera_track" | "motion_profile"
> & {
  motion_profile: Omit<Api.CompiledMotionProfile, "keyframes"> & {
    keyframes: SpeedKeyframe[];
  };
  camera_track: Omit<
    Api.CompiledCameraTrack,
    | "default_aim"
    | "default_orientation"
    | "keyframes"
    | "orientation_keyframes"
    | "depth_of_field_keyframes"
  > & {
    default_aim: ResolvedCameraAim;
    default_orientation: CameraOrientation;
    keyframes: CompiledCameraKeyframe[];
    orientation_keyframes: CameraOrientationKeyframe[];
    depth_of_field_keyframes: CompiledDepthOfFieldKeyframe[];
  };
};
