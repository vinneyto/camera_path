import type { CameraOrientation, Interpolation } from "@/entities/project";
import type { CompiledTrajectory } from "@/entities/trajectory/model/types";
import { interpolationWeight } from "@/entities/trajectory/lib/interpolation-weight";

interface OrientationControl {
  interpolation: Interpolation;
  orientation: CameraOrientation;
  pathPosition: number;
}

export function evaluateCameraOrientation(
  trajectory: CompiledTrajectory,
  pathPosition: number,
): CameraOrientation {
  const defaultOrientation = trajectory.camera_track.default_orientation;
  const controls: OrientationControl[] =
    trajectory.camera_track.orientation_keyframes.map((key) => ({
      interpolation: key.interpolation_to_next,
      orientation: key.orientation,
      pathPosition: key.path_position,
    }));

  if (controls.length === 0 || controls[0].pathPosition > 0) {
    controls.unshift({
      interpolation: "smoothstep",
      orientation: defaultOrientation,
      pathPosition: 0,
    });
  }
  if (controls.at(-1)?.pathPosition !== 1) {
    controls.push({
      interpolation: "smoothstep",
      orientation: defaultOrientation,
      pathPosition: 1,
    });
  }

  const position = Math.min(1, Math.max(0, pathPosition));
  for (let index = 0; index < controls.length - 1; index += 1) {
    const left = controls[index];
    const right = controls[index + 1];
    if (position > right.pathPosition) continue;
    const width = right.pathPosition - left.pathPosition;
    const progress = width > 0 ? (position - left.pathPosition) / width : 1;
    const weight =
      left.interpolation === "hold" && progress >= 1
        ? 1
        : interpolationWeight(progress, left.interpolation);
    return {
      yaw_deg:
        left.orientation.yaw_deg +
        (right.orientation.yaw_deg - left.orientation.yaw_deg) * weight,
      pitch_deg:
        left.orientation.pitch_deg +
        (right.orientation.pitch_deg - left.orientation.pitch_deg) * weight,
      roll_deg:
        left.orientation.roll_deg +
        (right.orientation.roll_deg - left.orientation.roll_deg) * weight,
    };
  }

  return { ...defaultOrientation };
}
