import { Sphere, Vector3 } from "three/webgpu";

import type { SceneSurfaceBounds } from "@/shared/scene-surface";

export function mergeSurfaceBounds(
  bounds: Iterable<SceneSurfaceBounds>,
): SceneSurfaceBounds | null {
  const combined = new Sphere();
  combined.makeEmpty();
  for (const bound of bounds) {
    combined.union(new Sphere(new Vector3(...bound.center), bound.radius));
  }
  if (combined.isEmpty()) return null;
  return { center: combined.center.toArray(), radius: combined.radius };
}
