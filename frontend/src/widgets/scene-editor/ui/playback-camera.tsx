import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import {
  Matrix4,
  Quaternion,
  Vector3,
  type Group,
  type InstancedMesh,
} from "three";

import { evaluateTrajectoryCameraPose, type CompiledTrajectory } from "@/entities/trajectory";
import { RENDER_PIPELINE_OVERLAY_LAYER } from "@/shared/three";

import { PLAYBACK_CAMERA_FRUSTUM } from "../lib/create-playback-camera-frustum";

interface PlaybackCameraProps {
  pathPosition: number;
  trajectory: CompiledTrajectory;
}

const EDGE_RADIUS = 0.008;
const EDGE_UP = new Vector3(0, 1, 0);

export function PlaybackCamera({ pathPosition, trajectory }: PlaybackCameraProps) {
  const helperRef = useRef<Group>(null);
  const edgeInstancesRef = useRef<InstancedMesh>(null);
  const cornerInstancesRef = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const edgeInstances = edgeInstancesRef.current;
    const cornerInstances = cornerInstancesRef.current;
    if (edgeInstances === null || cornerInstances === null) return;

    const direction = new Vector3();
    const start = new Vector3();
    const end = new Vector3();
    const midpoint = new Vector3();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    const matrix = new Matrix4();

    PLAYBACK_CAMERA_FRUSTUM.segments.forEach(([startTuple, endTuple], index) => {
      start.fromArray(startTuple);
      end.fromArray(endTuple);
      direction.subVectors(end, start);
      const length = direction.length();
      midpoint.addVectors(start, end).multiplyScalar(0.5);
      quaternion.setFromUnitVectors(EDGE_UP, direction.normalize());
      scale.set(1, length, 1);
      matrix.compose(midpoint, quaternion, scale);
      edgeInstances.setMatrixAt(index, matrix);
    });
    edgeInstances.instanceMatrix.needsUpdate = true;

    PLAYBACK_CAMERA_FRUSTUM.corners.forEach((corner, index) => {
      matrix.makeTranslation(...corner);
      cornerInstances.setMatrixAt(index, matrix);
    });
    cornerInstances.instanceMatrix.needsUpdate = true;

    edgeInstances.layers.set(RENDER_PIPELINE_OVERLAY_LAYER);
    cornerInstances.layers.set(RENDER_PIPELINE_OVERLAY_LAYER);
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
    <group ref={helperRef}>
      <instancedMesh
        args={[undefined, undefined, PLAYBACK_CAMERA_FRUSTUM.segments.length]}
        raycast={() => undefined}
        ref={edgeInstancesRef}
        renderOrder={1}
      >
        <cylinderGeometry args={[EDGE_RADIUS, EDGE_RADIUS, 1, 8]} />
        <meshStandardMaterial
          color="#fb923c"
          depthTest={false}
          depthWrite={false}
          emissive="#7c2d12"
          emissiveIntensity={0.45}
          metalness={0}
          opacity={0.85}
          roughness={0.55}
          transparent
        />
      </instancedMesh>
      <instancedMesh
        args={[undefined, undefined, PLAYBACK_CAMERA_FRUSTUM.corners.length]}
        raycast={() => undefined}
        ref={cornerInstancesRef}
        renderOrder={1}
      >
        <sphereGeometry args={[EDGE_RADIUS, 8, 6]} />
        <meshStandardMaterial
          color="#fb923c"
          depthTest={false}
          depthWrite={false}
          emissive="#7c2d12"
          emissiveIntensity={0.45}
          metalness={0}
          opacity={0.85}
          roughness={0.55}
          transparent
        />
      </instancedMesh>
    </group>
  );
}
