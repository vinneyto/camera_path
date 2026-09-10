import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Quaternion, Vector3, type Group } from "three";

import {
  evaluateTrajectoryCameraPose,
  type CompiledTrajectory,
} from "@/entities/trajectory";
import { RENDER_PIPELINE_OVERLAY_LAYER } from "@/shared/three";

import { PLAYBACK_CAMERA_HELPER_SEGMENTS } from "../lib/create-playback-camera-helper-segments";

interface PlaybackCameraProps {
  pathPosition: number;
  trajectory: CompiledTrajectory;
}

const EDGE_RADIUS = 0.006;
const EDGE_UP = new Vector3(0, 1, 0);

export function PlaybackCamera({
  pathPosition,
  trajectory,
}: PlaybackCameraProps) {
  const helperRef = useRef<Group>(null);

  useFrame(() => {
    const helper = helperRef.current;
    if (helper === null) return;

    const pose = evaluateTrajectoryCameraPose(trajectory, pathPosition);
    helper.position.copy(pose.position);
    helper.quaternion.copy(pose.quaternion);
    helper.updateMatrixWorld();
  });

  return (
    <group ref={helperRef}>
      {PLAYBACK_CAMERA_HELPER_SEGMENTS.map((segment, index) => {
        const start = new Vector3().fromArray(segment.start);
        const end = new Vector3().fromArray(segment.end);
        const direction = end.clone().sub(start);
        const length = direction.length();
        const position = start.clone().add(end).multiplyScalar(0.5);
        const quaternion = new Quaternion().setFromUnitVectors(
          EDGE_UP,
          direction.normalize(),
        );

        return (
          <mesh
            frustumCulled={false}
            key={index}
            onUpdate={(object) => {
              object.layers.set(RENDER_PIPELINE_OVERLAY_LAYER);
            }}
            position={position}
            quaternion={quaternion}
            raycast={() => undefined}
            renderOrder={1}
            scale={[1, length, 1]}
          >
            <cylinderGeometry args={[EDGE_RADIUS, EDGE_RADIUS, 1, 8]} />
            <meshStandardMaterial
              color={segment.color}
              depthTest={false}
              depthWrite={false}
              emissive={segment.color}
              emissiveIntensity={0.25}
              metalness={0}
              roughness={0.5}
              toneMapped={false}
              transparent
            />
          </mesh>
        );
      })}
    </group>
  );
}
