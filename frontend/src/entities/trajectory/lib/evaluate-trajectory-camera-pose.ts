import { Matrix4, Quaternion, Vector3 } from "three";

import type { CompiledTrajectory } from "@/entities/trajectory/model/types";
import { evaluateAim } from "@/entities/trajectory/lib/evaluate-aim";
import { evaluateCameraOrientation } from "@/entities/trajectory/lib/evaluate-camera-orientation";
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

  const baseUp = new Vector3(...trajectory.camera_track.world_up);
  if (baseUp.lengthSq() === 0) baseUp.set(0, 1, 0);
  baseUp.normalize();
  if (Math.abs(baseUp.dot(direction)) > 0.999) {
    baseUp.set(1, 0, 0);
    if (Math.abs(baseUp.dot(direction)) > 0.999) baseUp.set(0, 0, 1);
  }

  const rotation = new Matrix4().lookAt(
    sample.position,
    sample.position.clone().add(direction),
    baseUp,
  );

  const quaternion = new Quaternion().setFromRotationMatrix(rotation);
  const orientation = evaluateCameraOrientation(trajectory, pathPosition);
  quaternion
    .multiply(
      new Quaternion().setFromAxisAngle(
        new Vector3(0, 1, 0),
        (orientation.yaw_deg * Math.PI) / 180,
      ),
    )
    .multiply(
      new Quaternion().setFromAxisAngle(
        new Vector3(1, 0, 0),
        (orientation.pitch_deg * Math.PI) / 180,
      ),
    )
    .multiply(
      new Quaternion().setFromAxisAngle(
        new Vector3(0, 0, -1),
        (orientation.roll_deg * Math.PI) / 180,
      ),
    );

  return {
    position: sample.position,
    quaternion,
    up: new Vector3(0, 1, 0).applyQuaternion(quaternion),
  };
}
