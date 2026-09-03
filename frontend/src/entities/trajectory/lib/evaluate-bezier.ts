import { Vector3 } from "three";

import type { CubicBezier3D } from "@/entities/trajectory/model/types";

export function evaluateBezier(segment: CubicBezier3D, t: number): Vector3 {
  const u = 1 - t;
  return new Vector3()
    .addScaledVector(new Vector3(...segment.p0), u * u * u)
    .addScaledVector(new Vector3(...segment.p1), 3 * u * u * t)
    .addScaledVector(new Vector3(...segment.p2), 3 * u * t * t)
    .addScaledVector(new Vector3(...segment.p3), t * t * t);
}
