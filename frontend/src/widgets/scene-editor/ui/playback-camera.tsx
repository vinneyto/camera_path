import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import { CameraHelper, PerspectiveCamera } from "three";

import { evaluateTrajectoryCameraPose, type CompiledTrajectory } from "@/entities/trajectory";
import { RENDER_PIPELINE_OVERLAY_LAYER, useRetainedDisposable } from "@/shared/three";

interface PlaybackCameraProps {
  pathPosition: number;
  trajectory: CompiledTrajectory;
}

export function PlaybackCamera({ pathPosition, trajectory }: PlaybackCameraProps) {
  const camera = useMemo(() => new PerspectiveCamera(50, 1.4, 0.12, 0.7), []);
  const helper = useMemo(() => {
    const value = new CameraHelper(camera);
    value.layers.set(RENDER_PIPELINE_OVERLAY_LAYER);
    const materials = Array.isArray(value.material) ? value.material : [value.material];
    for (const material of materials) {
      material.depthTest = false;
      material.depthWrite = false;
      material.transparent = true;
    }
    return value;
  }, [camera]);

  useRetainedDisposable(helper);

  useFrame(() => {
    const pose = evaluateTrajectoryCameraPose(trajectory, pathPosition);
    camera.position.copy(pose.position);
    camera.quaternion.copy(pose.quaternion);
    camera.up.copy(pose.up);
    camera.updateMatrixWorld();
    helper.update();
  });

  return <primitive object={helper} />;
}
