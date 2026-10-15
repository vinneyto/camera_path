import type { Interpolation, SpeedKeyframe } from "@camera-path/types/project";
import type { CompiledTrajectory } from "@camera-path/types/trajectory";

export interface SpeedControl {
  pathPosition: number;
  speed: number;
  interpolation: Interpolation;
}

export function speedControls(
  trajectory: Pick<CompiledTrajectory, "motion_profile">,
): SpeedControl[] {
  const defaultSpeed = trajectory.motion_profile.default_speed;
  const keys: SpeedKeyframe[] = [...trajectory.motion_profile.keyframes].sort(
    (a, b) => a.path_position - b.path_position,
  );
  const controls = keys.map((key) => ({
    pathPosition: key.path_position,
    speed: key.speed,
    interpolation: key.interpolation_to_next,
  }));

  if (controls.length === 0 || controls[0].pathPosition > 0) {
    controls.unshift({
      pathPosition: 0,
      speed: defaultSpeed,
      interpolation: "smoothstep",
    });
  }
  if (controls.at(-1)?.pathPosition !== 1) {
    controls.push({
      pathPosition: 1,
      speed: defaultSpeed,
      interpolation: "smoothstep",
    });
  }
  return controls;
}
