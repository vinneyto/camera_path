import type { ThreeEvent } from "@react-three/fiber";

import type { SceneSurfaceHit } from "../../model/scene-surface-types";

export function getTileSurfaceHit(event: ThreeEvent<MouseEvent>): SceneSurfaceHit {
  const normal = event.face?.normal.clone().transformDirection(event.object.matrixWorld).normalize()
    ?? event.ray.direction.clone().negate().normalize();
  return {
    normal: normal.toArray(),
    position: event.point.toArray(),
  };
}
