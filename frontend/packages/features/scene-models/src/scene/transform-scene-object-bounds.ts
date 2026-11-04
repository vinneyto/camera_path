import { Box3, Matrix4, Vector3 } from "three";
import type { SceneSurfaceBounds } from "@camera-path/scene-runtime/surface";

export function transformSceneObjectBounds(
  bounds: SceneSurfaceBounds,
  matrix: Matrix4,
): SceneSurfaceBounds {
  const center = new Vector3(...bounds.center).applyMatrix4(matrix);
  const box =
    bounds.min && bounds.max
      ? new Box3(
          new Vector3(...bounds.min),
          new Vector3(...bounds.max),
        ).applyMatrix4(matrix)
      : null;
  // sqrt(||A||1 * ||A||infinity) bounds the largest singular value, including shear
  // from a rotated child of a nonuniformly scaled parent. Column lengths alone do not.
  const e = matrix.elements;
  const col = Math.max(
    ...[0, 4, 8].map(
      (i) => Math.abs(e[i]) + Math.abs(e[i + 1]) + Math.abs(e[i + 2]),
    ),
  );
  const row = Math.max(
    ...[0, 1, 2].map(
      (i) => Math.abs(e[i]) + Math.abs(e[i + 4]) + Math.abs(e[i + 8]),
    ),
  );
  return {
    center: center.toArray(),
    radius: bounds.radius * Math.sqrt(col * row),
    ...(box && { min: box.min.toArray(), max: box.max.toArray() }),
  };
}
