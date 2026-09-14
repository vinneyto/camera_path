import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import {
  Mesh,
  PerspectiveCamera,
  Quaternion,
  Raycaster,
  Vector2,
  Vector3,
} from "three";

import {
  evaluateTrajectoryCameraPose,
  type CompiledTrajectory,
  type ResolvedDepthOfFieldFocus,
} from "@/entities/trajectory";
import {
  DEPTH_OF_FIELD_AUTOFOCUS_LAYER,
  forEachCenterWeightedAutofocusRay,
  RENDER_PIPELINE_OVERLAY_LAYER,
} from "@/shared/three";

interface DepthOfFieldFocusHelperProps {
  fallbackRayLength: number;
  focus: ResolvedDepthOfFieldFocus;
  pathPosition: number;
  trajectory: CompiledTrajectory;
}

interface DepthOfFieldFocusHelperResources {
  camera: PerspectiveCamera;
  direction: Vector3;
  end: Vector3;
  midpoint: Vector3;
  pointer: Vector2;
  principalPoint: Vector3;
  quaternion: Quaternion;
  raycaster: Raycaster;
}

const RAY_COUNT = 9;
const RAY_RADIUS = 0.004;
const UP = new Vector3(0, 1, 0);

export function DepthOfFieldFocusHelper({
  fallbackRayLength,
  focus,
  pathPosition,
  trajectory,
}: DepthOfFieldFocusHelperProps) {
  const viewCamera = useThree((state) => state.camera);
  const scene = useThree((state) => state.scene);
  const rayMeshesRef = useRef<Array<Mesh | null>>([]);
  const resourcesRef = useRef<DepthOfFieldFocusHelperResources | null>(null);

  useLayoutEffect(() => {
    const raycaster = new Raycaster();
    raycaster.layers.set(DEPTH_OF_FIELD_AUTOFOCUS_LAYER);
    resourcesRef.current = {
      camera: new PerspectiveCamera(),
      direction: new Vector3(),
      end: new Vector3(),
      midpoint: new Vector3(),
      pointer: new Vector2(),
      principalPoint: new Vector3(),
      quaternion: new Quaternion(),
      raycaster,
    };
    return () => {
      resourcesRef.current = null;
    };
  }, []);

  useFrame(() => {
    const resources = resourcesRef.current;
    if (resources === null || !(viewCamera instanceof PerspectiveCamera))
      return;
    const activeResources = resources;
    const pose = evaluateTrajectoryCameraPose(trajectory, pathPosition);
    const helperCamera = resources.camera;
    helperCamera.position.copy(pose.position);
    helperCamera.quaternion.copy(pose.quaternion);
    helperCamera.up.copy(pose.up);
    helperCamera.near = viewCamera.near;
    helperCamera.far = viewCamera.far;
    helperCamera.projectionMatrix.copy(viewCamera.projectionMatrix);
    helperCamera.projectionMatrixInverse.copy(
      viewCamera.projectionMatrixInverse,
    );
    helperCamera.updateMatrixWorld(true);
    scene.updateMatrixWorld(true);
    for (const mesh of rayMeshesRef.current) {
      if (mesh !== null) mesh.visible = false;
    }

    function placeRay(index: number, origin: Vector3, end: Vector3) {
      const mesh = rayMeshesRef.current[index];
      if (mesh === null || mesh === undefined) return;
      const direction = activeResources.direction.copy(end).sub(origin);
      const length = direction.length();
      if (length === 0) return;
      mesh.visible = true;
      mesh.position.copy(
        activeResources.midpoint.copy(origin).add(end).multiplyScalar(0.5),
      );
      mesh.quaternion.copy(
        activeResources.quaternion.setFromUnitVectors(
          UP,
          direction.normalize(),
        ),
      );
      mesh.scale.set(RAY_RADIUS, length, RAY_RADIUS);
      mesh.updateMatrixWorld();
    }

    if (focus.kind === "scene_point") {
      placeRay(
        0,
        helperCamera.position,
        resources.end.fromArray(focus.position),
      );
      return;
    }

    forEachCenterWeightedAutofocusRay(
      helperCamera,
      resources.raycaster,
      resources,
      (raycaster, _sample, index) => {
        const hit = raycaster.intersectObjects(scene.children, true)[0];
        const length = hit?.distance ?? fallbackRayLength;
        placeRay(
          index,
          raycaster.ray.origin,
          resources.end
            .copy(raycaster.ray.direction)
            .multiplyScalar(length)
            .add(raycaster.ray.origin),
        );
      },
    );
  });

  return (
    <group>
      {Array.from({ length: RAY_COUNT }, (_, index) => (
        <mesh
          frustumCulled={false}
          key={index}
          onUpdate={(object) => {
            object.layers.set(RENDER_PIPELINE_OVERLAY_LAYER);
            rayMeshesRef.current[index] = object;
          }}
          raycast={() => undefined}
          renderOrder={2}
          visible={false}
        >
          <cylinderGeometry args={[1, 1, 1, 8]} />
          <meshBasicMaterial
            color={index === 0 ? "#facc15" : "#22d3ee"}
            depthTest={false}
            depthWrite={false}
            opacity={index === 0 ? 1 : 0.7}
            toneMapped={false}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}
