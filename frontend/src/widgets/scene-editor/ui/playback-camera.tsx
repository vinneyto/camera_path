import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { CameraHelper, PerspectiveCamera, Vector3 } from "three";

import { evaluateAim, locateOnPath, type CompiledTrajectory } from "@/entities/trajectory";
import { RENDER_PIPELINE_OVERLAY_LAYER } from "@/shared/three";

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

  useEffect(() => () => helper.dispose(), [helper]);

  useFrame(() => {
    const sample = locateOnPath(trajectory, pathPosition);
    const direction = evaluateAim(trajectory, pathPosition);
    camera.position.copy(sample.position);
    camera.up.set(...trajectory.camera_track.world_up);
    camera.lookAt(sample.position.clone().add(direction.lengthSq() ? direction : new Vector3(0, 0, -1)));
    camera.updateMatrixWorld();
    helper.update();
  });

  return <primitive object={helper} />;
}
