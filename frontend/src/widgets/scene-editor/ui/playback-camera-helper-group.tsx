import { useLayoutEffect, useRef } from "react";
import {
  Matrix4,
  Quaternion,
  Vector3,
  type InstancedMesh,
} from "three";

import { RENDER_PIPELINE_OVERLAY_LAYER } from "@/shared/three";

import type { PlaybackCameraHelperGroup as PlaybackCameraHelperGroupData } from "../lib/create-playback-camera-frustum";

interface PlaybackCameraHelperGroupProps {
  group: PlaybackCameraHelperGroupData;
}

const EDGE_RADIUS = 0.008;
const EDGE_UP = new Vector3(0, 1, 0);

export function PlaybackCameraHelperGroup({ group }: PlaybackCameraHelperGroupProps) {
  const edgeInstancesRef = useRef<InstancedMesh>(null);
  const jointInstancesRef = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const edgeInstances = edgeInstancesRef.current;
    const jointInstances = jointInstancesRef.current;
    if (edgeInstances === null || jointInstances === null) return;

    const direction = new Vector3();
    const start = new Vector3();
    const end = new Vector3();
    const midpoint = new Vector3();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    const matrix = new Matrix4();

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
  }, [group]);

  return (
    <>
      <instancedMesh
        args={[undefined, undefined, group.segments.length]}
        raycast={() => undefined}
        ref={edgeInstancesRef}
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
        raycast={() => undefined}
        ref={jointInstancesRef}
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
    </>
  );
}
