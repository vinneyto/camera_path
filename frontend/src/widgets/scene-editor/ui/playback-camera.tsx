import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { CameraHelper, PerspectiveCamera, Vector3 } from "three";

import type { CompiledTrajectory } from "@/entities/trajectory/model/types";
import { evaluateAim } from "@/entities/trajectory/lib/evaluate-aim";
import { locateOnPath } from "@/entities/trajectory/lib/locate-on-path";

interface PlaybackCameraProps {
  pathPosition: number;
  trajectory: CompiledTrajectory;
}

export function PlaybackCamera({ pathPosition, trajectory }: PlaybackCameraProps) {
  const camera = useMemo(() => new PerspectiveCamera(50, 1.4, 0.12, 0.7), []);
  const helper = useMemo(() => new CameraHelper(camera), [camera]);

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
