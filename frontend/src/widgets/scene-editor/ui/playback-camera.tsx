import { useFrame, useThree } from "@react-three/fiber";
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
  const invalidate = useThree((state) => state.invalidate);
  const helperRef = useRef<Group>(null);
  const edgeInstancesRefs = useRef<Array<InstancedMesh | null>>([]);
  const jointInstancesRefs = useRef<Array<InstancedMesh | null>>([]);

  useLayoutEffect(() => {
    const direction = new Vector3();
    const start = new Vector3();
    const end = new Vector3();
    const midpoint = new Vector3();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    const matrix = new Matrix4();

    PLAYBACK_CAMERA_FRUSTUM.groups.forEach((group, groupIndex) => {
      const edgeInstances = edgeInstancesRefs.current[groupIndex];
      const jointInstances = jointInstancesRefs.current[groupIndex];
      if (!edgeInstances || !jointInstances) return;

      group.segments.forEach((segment, index) => {
        start.fromArray(segment.start);
        end.fromArray(segment.end);
        direction.subVectors(end, start);
        const length = direction.length();
        midpoint.addVectors(start, end).multiplyScalar(0.5);
        quaternion.setFromUnitVectors(EDGE_UP, direction.normalize());
        scale.set(1, length, 1);
        matrix.compose(midpoint, quaternion, scale);
        edgeInstances.setMatrixAt(index, matrix);
      });
      edgeInstances.instanceMatrix.needsUpdate = true;

      group.joints.forEach((joint, index) => {
        matrix.makeTranslation(...joint.position);
        jointInstances.setMatrixAt(index, matrix);
      });
      jointInstances.instanceMatrix.needsUpdate = true;

      edgeInstances.layers.set(RENDER_PIPELINE_OVERLAY_LAYER);
      jointInstances.layers.set(RENDER_PIPELINE_OVERLAY_LAYER);
    });

    invalidate();
  }, [invalidate]);

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
      {PLAYBACK_CAMERA_FRUSTUM.groups.map((group, groupIndex) => (
        <group key={group.color}>
          <instancedMesh
            args={[undefined, undefined, group.segments.length]}
            frustumCulled={false}
            raycast={() => undefined}
            ref={(value) => {
              edgeInstancesRefs.current[groupIndex] = value;
            }}
            renderOrder={1}
          >
            <cylinderGeometry args={[EDGE_RADIUS, EDGE_RADIUS, 1, 8]} />
            <meshStandardMaterial
              color={group.color}
              depthTest={false}
              depthWrite={false}
              emissive={group.color}
              emissiveIntensity={0.25}
              metalness={0}
              roughness={0.5}
              toneMapped={false}
            />
          </instancedMesh>
          <instancedMesh
            args={[undefined, undefined, group.joints.length]}
            frustumCulled={false}
            raycast={() => undefined}
            ref={(value) => {
              jointInstancesRefs.current[groupIndex] = value;
            }}
            renderOrder={1}
          >
            <sphereGeometry args={[EDGE_RADIUS, 8, 6]} />
            <meshStandardMaterial
              color={group.color}
              depthTest={false}
              depthWrite={false}
              emissive={group.color}
              emissiveIntensity={0.25}
              metalness={0}
              roughness={0.5}
              toneMapped={false}
            />
          </instancedMesh>
        </group>
      ))}
    </group>
  );
}
