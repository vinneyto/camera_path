"use client";
import { trajectoryCameraPose } from "@camera-path/contracts/host-data";
import { useFeatureHost, useHostFrame } from "@camera-path/extension-api";
import { useThree } from "@react-three/fiber";
import { useLayoutEffect } from "react";
import type { PerspectiveCamera } from "three";
import { manifest } from "../manifest";

import { activateTrajectoryCamera } from "@camera-path/feature-camera-view/lib/activate-trajectory-camera";

export function TrajectoryCameraControl() {
  const host = useFeatureHost(manifest);
  const camera = useThree((state) => state.camera) as PerspectiveCamera;

  useLayoutEffect(() => activateTrajectoryCamera(camera), [camera]);

  useHostFrame(manifest, "camera-view.update", () => {
    const pose = host.data.read(trajectoryCameraPose);
    if (!pose) return;
    camera.position.fromArray(pose.position);
    camera.quaternion.fromArray(pose.orientation);
    camera.up.fromArray(pose.up);
    camera.updateMatrixWorld();
  });

  return null;
}
