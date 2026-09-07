import { Matrix4, Quaternion, Vector3 } from "three";

import type { CompiledTrajectory } from "@/entities/trajectory/model/types";
import { evaluateAim } from "@/entities/trajectory/lib/evaluate-aim";
import { locateOnPath } from "@/entities/trajectory/lib/locate-on-path";

export interface TrajectoryCameraPose {
  position: Vector3;
  quaternion: Quaternion;
  up: Vector3;
}

export function evaluateTrajectoryCameraPose(
  trajectory: CompiledTrajectory,
  pathPosition: number,
): TrajectoryCameraPose {
  const sample = locateOnPath(trajectory, pathPosition);
  const direction = evaluateAim(trajectory, pathPosition);
  if (direction.lengthSq() === 0) direction.copy(sample.tangent);
  if (direction.lengthSq() === 0) direction.set(0, 0, -1);
  direction.normalize();

  const up = new Vector3(...trajectory.camera_track.world_up);
  if (up.lengthSq() === 0) up.set(0, 1, 0);
  up.normalize();

  const rotation = new Matrix4().lookAt(
    sample.position,
    sample.position.clone().add(direction),
    up,
  );

  return {
    position: sample.position,
    quaternion: new Quaternion().setFromRotationMatrix(rotation),
    up,
  };
}
