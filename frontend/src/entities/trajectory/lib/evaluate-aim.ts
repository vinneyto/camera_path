import { Vector3 } from "three";

import type { Interpolation } from "@/entities/project/model/types";
import type { CompiledTrajectory, ResolvedCameraAim } from "@/entities/trajectory/model/types";
import { aimDirection } from "@/entities/trajectory/lib/aim-direction";
import { interpolationWeight } from "@/entities/trajectory/lib/interpolation-weight";

interface AimControl {
  pathPosition: number;
  aim: ResolvedCameraAim;
  interpolation: Interpolation;
}

export function evaluateAim(trajectory: CompiledTrajectory, pathPosition: number): Vector3 {
  const defaultAim = trajectory.camera_track.default_aim;
  const controls: AimControl[] = trajectory.camera_track.keyframes.map((key) => ({
    pathPosition: key.path_position,
    aim: key.aim,
    interpolation: key.interpolation_to_next,
  }));

  if (controls.length === 0 || controls[0].pathPosition > 0) {
    controls.unshift({ pathPosition: 0, aim: defaultAim, interpolation: "smoothstep" });
  }
  if (controls.at(-1)?.pathPosition !== 1) {
    controls.push({ pathPosition: 1, aim: defaultAim, interpolation: "smoothstep" });
  }

  const position = Math.min(1, Math.max(0, pathPosition));
  for (let index = 0; index < controls.length - 1; index += 1) {
    const left = controls[index];
    const right = controls[index + 1];
    if (position <= right.pathPosition) {
      const width = right.pathPosition - left.pathPosition;
      const weight = width > 0
        ? interpolationWeight((position - left.pathPosition) / width, left.interpolation)
        : 1;
      return aimDirection(trajectory, position, left.aim)
        .lerp(aimDirection(trajectory, position, right.aim), weight)
        .normalize();
    }
  }

  return aimDirection(trajectory, position, defaultAim);
}
