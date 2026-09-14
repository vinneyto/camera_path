import type {
  CompiledTrajectory,
  ResolvedDepthOfFieldFocus,
} from "../model/types";

export function evaluateDepthOfFieldFocus(
  trajectory: CompiledTrajectory,
  pathPosition: number,
): ResolvedDepthOfFieldFocus | null {
  const keyframes = trajectory.camera_track.depth_of_field_keyframes;
  if (keyframes.length === 0) return null;

  const position = Math.min(1, Math.max(0, pathPosition));
  let active = keyframes[0];
  for (const keyframe of keyframes) {
    if (keyframe.path_position > position) break;
    active = keyframe;
  }
  return active.focus;
}
