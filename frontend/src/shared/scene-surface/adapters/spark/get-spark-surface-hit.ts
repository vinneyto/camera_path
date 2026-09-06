import type { ThreeEvent } from "@react-three/fiber";

import type { SceneSurfaceHit } from "../../model/scene-surface-types";

export function getSparkSurfaceHit(event: ThreeEvent<MouseEvent>): SceneSurfaceHit {
  return {
    normal: event.ray.direction.clone().negate().normalize().toArray(),
    position: event.point.toArray(),
  };
}
