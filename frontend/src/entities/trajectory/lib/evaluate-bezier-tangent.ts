import { Vector3 } from "three";

import type { CubicBezier3D } from "@/entities/trajectory/model/types";

export function evaluateBezierTangent(segment: CubicBezier3D, t: number): Vector3 {
  const u = 1 - t;
  const p0 = new Vector3(...segment.p0);
  const p1 = new Vector3(...segment.p1);
  const p2 = new Vector3(...segment.p2);
  const p3 = new Vector3(...segment.p3);

  return p1
    .sub(p0)
    .multiplyScalar(3 * u * u)
    .add(p2.clone().sub(new Vector3(...segment.p1)).multiplyScalar(6 * u * t))
    .add(p3.sub(new Vector3(...segment.p2)).multiplyScalar(3 * t * t))
    .normalize();
}
