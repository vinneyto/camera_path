"use client";
import type { ThreeEvent } from "@react-three/fiber";
import { DoubleSide, Mesh } from "three";

import type {
  SceneSurfaceHit,
  SceneSurfaceProps,
} from "@camera-path/scene-runtime/surface";
import {
  RENDER_PIPELINE_PRE_SPLAT_TRANSPARENT_LAYER,
  RENDER_PIPELINE_SCENE_LAYER,
  useOptionalRenderPipeline,
} from "@camera-path/render-pipeline";
import type { Vec3 } from "@camera-path/types/project";
import {
  SCENE_GRID_DIVISIONS,
  SCENE_GRID_PLANE_ROTATION,
  SCENE_GRID_SIZE,
} from "../constants";
import { selectSceneGridAppearance } from "../selectors/select-scene-grid-appearance";

type PlacementEvents = Pick<
  SceneSurfaceProps,
  | "onSurfacePointerDown"
  | "onSurfacePointerMove"
  | "onSurfacePointerUp"
  | "onPointerOut"
  | "onPointerCancel"
>;

interface SceneGridProps {
  dark: boolean;
  interactive: boolean;
  placementEvents: PlacementEvents;
}

export function SceneGrid({
  dark,
  interactive,
  placementEvents,
}: SceneGridProps) {
  const pipeline = useOptionalRenderPipeline();
  const appearance = selectSceneGridAppearance({
    dark,
    webgpu: pipeline !== null,
  });

  function assignRenderLayer(object: {
    layers: { set: (layer: number) => void };
  }) {
    object.layers.set(
      pipeline
        ? RENDER_PIPELINE_PRE_SPLAT_TRANSPARENT_LAYER
        : RENDER_PIPELINE_SCENE_LAYER,
    );
  }

  function isFrontmost(event: ThreeEvent<PointerEvent>) {
    return event.intersections[0]?.object === event.object;
  }

  function hit(event: ThreeEvent<PointerEvent>): SceneSurfaceHit {
    return { position: event.point.toArray() as Vec3, normal: [0, 1, 0] };
  }

  // WebGL: grid (-3/-2), Spark (-1), then transparent helpers (0 and up).
  // WebGPU keeps its separate pre-splat pass and the existing grid ordering.
  return (
    <group>
      <mesh
        onPointerCancel={placementEvents.onPointerCancel}
        onPointerDown={(event) => {
          if (isFrontmost(event))
            placementEvents.onSurfacePointerDown?.(hit(event), event);
        }}
        onPointerMove={(event) => {
          if (isFrontmost(event))
            placementEvents.onSurfacePointerMove?.(hit(event), event);
        }}
        onPointerOut={placementEvents.onPointerOut}
        onUpdate={assignRenderLayer}
        onPointerUp={(event) => {
          if (isFrontmost(event))
            placementEvents.onSurfacePointerUp?.(hit(event), event);
        }}
        raycast={interactive ? Mesh.prototype.raycast : () => undefined}
        userData={{ sceneSurfacePickable: interactive }}
        renderOrder={appearance.renderOrder.plane}
        rotation={SCENE_GRID_PLANE_ROTATION}
      >
        <planeGeometry args={[SCENE_GRID_SIZE, SCENE_GRID_SIZE]} />
        <meshBasicMaterial
          color={appearance.planeColor}
          depthWrite={Boolean(pipeline)}
          opacity={appearance.planeOpacity}
          side={DoubleSide}
          transparent
        />
      </mesh>
      <gridHelper
        args={[SCENE_GRID_SIZE, SCENE_GRID_DIVISIONS]}
        onUpdate={assignRenderLayer}
        raycast={() => undefined}
        renderOrder={appearance.renderOrder.lines}
      >
        <lineBasicMaterial
          color={appearance.lineColor}
          depthTest={false}
          depthWrite={false}
          opacity={appearance.lineOpacity}
          transparent
        />
      </gridHelper>
    </group>
  );
}
