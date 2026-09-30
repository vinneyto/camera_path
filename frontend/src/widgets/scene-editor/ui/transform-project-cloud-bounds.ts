import { Box3, Euler, MathUtils, Matrix4, Quaternion, Vector3 } from "three";

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
  const box =
    bounds.min && bounds.max
      ? new Box3(new Vector3(...bounds.min), new Vector3(...bounds.max))
          .translate(new Vector3(...cloud.offset))
          .applyMatrix4(
            new Matrix4().compose(
              new Vector3(...cloud.translation),
              new Quaternion().setFromEuler(rotation),
              new Vector3(cloud.scale, cloud.scale, cloud.scale),
            ),
          )
      : null;
  return {
    center: center.toArray(),
    radius: bounds.radius * Math.abs(cloud.scale),
    ...(box && { min: box.min.toArray(), max: box.max.toArray() }),
  };
}
