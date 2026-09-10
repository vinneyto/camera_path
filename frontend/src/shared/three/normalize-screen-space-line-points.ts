import { Vector3 } from "three";

import type { ScreenSpaceLinePoint } from "./screen-space-line";

const MIN_POINT_DISTANCE_SQUARED = 1e-12;

export function normalizeScreenSpaceLinePoints(
  points: readonly ScreenSpaceLinePoint[],
) {
  const normalized: Vector3[] = [];
  for (const point of points) {
    const vector =
      point instanceof Vector3 ? point.clone() : new Vector3(...point);
    const previous = normalized.at(-1);
    if (
      previous &&
      previous.distanceToSquared(vector) <= MIN_POINT_DISTANCE_SQUARED
    )
      continue;
    normalized.push(vector);
  }
  return normalized;
}
