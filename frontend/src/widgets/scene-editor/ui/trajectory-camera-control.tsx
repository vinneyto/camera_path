import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect } from "react";
import type { PerspectiveCamera } from "three";

import {
  evaluateTrajectoryCameraPose,
  type CompiledTrajectory,
} from "@/entities/trajectory";

import { activateTrajectoryCamera } from "../lib/activate-trajectory-camera";

interface TrajectoryCameraControlProps {
  pathPosition: number;
  trajectory: CompiledTrajectory;
}

export function TrajectoryCameraControl({
  pathPosition,
  trajectory,
}: TrajectoryCameraControlProps) {
  const camera = useThree((state) => state.camera) as PerspectiveCamera;

  useLayoutEffect(() => activateTrajectoryCamera(camera), [camera]);

  useFrame(() => {
    const pose = evaluateTrajectoryCameraPose(trajectory, pathPosition);
    camera.position.copy(pose.position);
    camera.quaternion.copy(pose.quaternion);
    camera.up.copy(pose.up);
    camera.updateMatrixWorld();
  });

  return null;
}
