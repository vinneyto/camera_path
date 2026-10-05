import type { ThreeEvent } from "@react-three/fiber";
import { DoubleSide } from "three";

import type { Vec3 } from "@/entities/project";
import type {
  SceneSurfaceHit,
  SceneSurfaceProps,
} from "@/shared/scene-surface";
import {
  RENDER_PIPELINE_PRE_SPLAT_TRANSPARENT_LAYER,
  useOptionalRenderPipeline,
} from "@/shared/three";

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

  function assignRenderLayer(object: {
    layers: { set: (layer: number) => void };
  }) {
    object.layers.set(
      pipeline ? RENDER_PIPELINE_PRE_SPLAT_TRANSPARENT_LAYER : 0,
    );
  }

  function isFrontmost(event: ThreeEvent<PointerEvent>) {
    return event.intersections[0]?.object === event.object;
  }

  function hit(event: ThreeEvent<PointerEvent>): SceneSurfaceHit {
    return { position: event.point.toArray() as Vec3, normal: [0, 1, 0] };
  }

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
        raycast={interactive ? undefined : () => undefined}
        userData={{ sceneSurfacePickable: interactive }}
        renderOrder={0}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[40, 40]} />
        <meshBasicMaterial
          color={dark ? "#8291aa" : "#94a3b8"}
          depthWrite={Boolean(pipeline)}
          opacity={dark ? 0.045 : 0.09}
          side={DoubleSide}
          transparent
        />
      </mesh>
      <gridHelper
        args={[40, 40]}
        onUpdate={assignRenderLayer}
        raycast={() => undefined}
        renderOrder={1}
      >
        <lineBasicMaterial
          color={dark ? "#9baac3" : "#526073"}
          depthTest={false}
          depthWrite={false}
          opacity={dark ? 0.28 : 0.22}
          transparent
        />
      </gridHelper>
    </group>
  );
}
