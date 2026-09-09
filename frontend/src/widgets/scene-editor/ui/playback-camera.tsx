import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import { DoubleSide, type Mesh } from "three";

import { evaluateTrajectoryCameraPose, type CompiledTrajectory } from "@/entities/trajectory";
import { RENDER_PIPELINE_OVERLAY_LAYER } from "@/shared/three";

import { PLAYBACK_CAMERA_FRUSTUM_POSITIONS } from "../lib/create-playback-camera-frustum-positions";

interface PlaybackCameraProps {
  pathPosition: number;
  trajectory: CompiledTrajectory;
}

export function PlaybackCamera({ pathPosition, trajectory }: PlaybackCameraProps) {
  const helperRef = useRef<Mesh>(null);

  useLayoutEffect(() => {
    helperRef.current?.layers.set(RENDER_PIPELINE_OVERLAY_LAYER);
  }, []);

  useFrame(() => {
    const helper = helperRef.current;
    if (helper === null) return;

    const pose = evaluateTrajectoryCameraPose(trajectory, pathPosition);
    helper.position.copy(pose.position);
    helper.quaternion.copy(pose.quaternion);
    helper.updateMatrixWorld();
  });

  return (
    <mesh ref={helperRef} raycast={() => undefined} renderOrder={1}>
      <bufferGeometry>
        <bufferAttribute
          args={[PLAYBACK_CAMERA_FRUSTUM_POSITIONS, 3]}
          attach="attributes-position"
        />
      </bufferGeometry>
      <meshBasicMaterial
        color="#fb923c"
        depthTest={false}
        depthWrite={false}
        opacity={0.16}
        side={DoubleSide}
        toneMapped={false}
        transparent
      />
    </mesh>
  );
}
