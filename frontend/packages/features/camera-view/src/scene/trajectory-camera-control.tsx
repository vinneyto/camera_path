"use client";
import { useTrajectoryPose } from "@camera-path/scene-runtime/viewport/trajectory-pose-provider";
import { useFrame } from "@react-three/fiber";

import { activateTrajectoryCamera } from "@camera-path/feature-camera-view/lib/activate-trajectory-camera";
import { useThree } from "@react-three/fiber";
import { useLayoutEffect } from "react";
import type { PerspectiveCamera } from "three";

export function TrajectoryCameraControl() {
  const trajectoryPose = useTrajectoryPose();
  const camera = useThree((state) => state.camera) as PerspectiveCamera;

  useLayoutEffect(() => activateTrajectoryCamera(camera), [camera]);

  useFrame(() => {
    const pose = trajectoryPose.current;
    if (!pose) return;
    camera.position.fromArray(pose.position);
    camera.quaternion.fromArray(pose.orientation);
    camera.up.fromArray(pose.up);
    camera.updateMatrixWorld();
  }, -1);

  return null;
}
