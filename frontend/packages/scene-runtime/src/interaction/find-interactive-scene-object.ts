import type { Intersection, Object3D } from "three";

/** The caller supplies distance-sorted hits. Never look through the first hit. */
export function findInteractiveSceneObject(
  intersections: readonly Intersection[],
  layer: number | readonly number[],
): Object3D | null {
  const layers = typeof layer === "number" ? [layer] : layer;
  let object: Object3D | null = intersections[0]?.object ?? null;
  while (object !== null) {
    const id: unknown = object.userData.sceneObjectID;
    if (
      layers.some((value) => object!.layers.isEnabled(value)) &&
      typeof id === "string" &&
      id.trim().length > 0
    )
      return object;
    object = object.parent;
  }
  return null;
}
