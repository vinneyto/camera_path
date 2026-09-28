import { Euler, MathUtils, Vector3 } from "three";

import type { ProjectCloud } from "@/shared/api/generated/model";
import type { SceneSurfaceBounds } from "@/shared/scene-surface";

export function transformProjectCloudBounds(
  bounds: SceneSurfaceBounds,
  cloud: ProjectCloud,
): SceneSurfaceBounds {
  const rotation = new Euler(...cloud.rotation_deg.map(MathUtils.degToRad));
  const center = new Vector3(...bounds.center)
    .add(new Vector3(...cloud.offset))
    .multiplyScalar(cloud.scale)
    .applyEuler(rotation)
    .add(new Vector3(...cloud.translation));
  return {
    center: center.toArray(),
    radius: bounds.radius * Math.abs(cloud.scale),
  };
}
