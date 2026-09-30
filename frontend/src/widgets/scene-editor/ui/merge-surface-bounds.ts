import { Box3, Sphere, Vector3 } from "three/webgpu";

import type { SceneSurfaceBounds } from "@/shared/scene-surface";

export function mergeSurfaceBounds(
  bounds: Iterable<SceneSurfaceBounds>,
): SceneSurfaceBounds | null {
  const combined = new Sphere();
  combined.makeEmpty();
  const box = new Box3();
  box.makeEmpty();
  for (const bound of bounds) {
    combined.union(new Sphere(new Vector3(...bound.center), bound.radius));
    if (bound.min && bound.max) {
      box.union(new Box3(new Vector3(...bound.min), new Vector3(...bound.max)));
    } else {
      const center = new Vector3(...bound.center);
      const extent = new Vector3(bound.radius, bound.radius, bound.radius);
      box.expandByPoint(center.clone().sub(extent));
      box.expandByPoint(center.add(extent));
    }
  }
  if (combined.isEmpty()) return null;
  return {
    center: combined.center.toArray(),
    radius: combined.radius,
    min: box.min.toArray(),
    max: box.max.toArray(),
  };
}
