import { Vector3 } from "three";

import type {
  CompiledTrajectory,
  ResolvedCameraAim,
} from "@camera-path/contracts/trajectory";
import { locateOnPath } from "@camera-path/trajectory-math/lib/locate-on-path";

export function aimDirection(
  trajectory: CompiledTrajectory,
  pathPosition: number,
  aim: ResolvedCameraAim,
): Vector3 {
  const sample = locateOnPath(trajectory, pathPosition);
  if (aim.kind === "follow_path") {
    return sample.tangent.multiplyScalar(aim.direction === "backward" ? -1 : 1);
  }
  return new Vector3(...aim.position).sub(sample.position).normalize();
}
