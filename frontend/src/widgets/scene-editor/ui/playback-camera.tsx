import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import {
  Color,
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

    PLAYBACK_CAMERA_FRUSTUM.segments.forEach((segment, index) => {
      start.fromArray(segment.start);
      end.fromArray(segment.end);
      direction.subVectors(end, start);
      const length = direction.length();
      midpoint.addVectors(start, end).multiplyScalar(0.5);
      quaternion.setFromUnitVectors(EDGE_UP, direction.normalize());
      scale.set(1, length, 1);
      matrix.compose(midpoint, quaternion, scale);
      edgeInstances.setMatrixAt(index, matrix);
      edgeInstances.setColorAt(index, new Color(segment.color));
    });
    edgeInstances.instanceMatrix.needsUpdate = true;
    if (edgeInstances.instanceColor !== null) edgeInstances.instanceColor.needsUpdate = true;

    PLAYBACK_CAMERA_FRUSTUM.joints.forEach((joint, index) => {
      matrix.makeTranslation(...joint.position);
      cornerInstances.setMatrixAt(index, matrix);
      cornerInstances.setColorAt(index, new Color(joint.color));
    });
    cornerInstances.instanceMatrix.needsUpdate = true;
    if (cornerInstances.instanceColor !== null) cornerInstances.instanceColor.needsUpdate = true;

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
          color="#ffffff"
          depthTest={false}
          depthWrite={false}
          emissive="#ffffff"
          emissiveIntensity={0.08}
          metalness={0}
          opacity={0.85}
          roughness={0.55}
          toneMapped={false}
          transparent
          vertexColors
        />
      </instancedMesh>
      <instancedMesh
        args={[undefined, undefined, PLAYBACK_CAMERA_FRUSTUM.joints.length]}
        raycast={() => undefined}
        ref={cornerInstancesRef}
        renderOrder={1}
      >
        <sphereGeometry args={[EDGE_RADIUS, 8, 6]} />
        <meshStandardMaterial
          color="#ffffff"
          depthTest={false}
          depthWrite={false}
          emissive="#ffffff"
          emissiveIntensity={0.08}
          metalness={0}
          opacity={0.85}
          roughness={0.55}
          toneMapped={false}
          transparent
          vertexColors
        />
      </instancedMesh>
    </group>
  );
}
