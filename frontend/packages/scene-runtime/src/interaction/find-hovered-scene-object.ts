import { HOVERABLE } from "@camera-path/render-pipeline";
import type { Intersection, Object3D } from "three";

/** The caller supplies distance-sorted hits. Never look through the first hit. */
export function findHoveredSceneObject(
  intersections: readonly Intersection[],
): Object3D | null {
  let object: Object3D | null = intersections[0]?.object ?? null;
  while (object !== null) {
    const id: unknown = object.userData.sceneObjectID;
    if (
      object.layers.isEnabled(HOVERABLE) &&
      typeof id === "string" &&
      id.trim().length > 0
    )
      return object;
    object = object.parent;
  }
  return null;
}
