import { Vector3, type Ray } from "three";

import type { Vec3 } from "@/entities/project";

const PARALLEL_EPSILON = 1e-6;

export function getWorldYAxisLift(ray: Ray, surfacePosition: Vec3): number | null {
  const direction = ray.direction.clone().normalize();
  const fromSurface = ray.origin.clone().sub(new Vector3(...surfacePosition));
  const verticalAlignment = direction.y;
  const denominator = 1 - verticalAlignment * verticalAlignment;
  if (denominator < PARALLEL_EPSILON) return null;

  const lift = (
    fromSurface.y - verticalAlignment * direction.dot(fromSurface)
  ) / denominator;
  const rayDistance = verticalAlignment * lift - direction.dot(fromSurface);
  if (rayDistance < 0) return null;
  return Math.max(0, lift);
}
