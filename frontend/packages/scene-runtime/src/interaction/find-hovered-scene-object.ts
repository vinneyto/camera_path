import { HOVERABLE } from "@camera-path/render-pipeline";
import type { Intersection, Object3D } from "three";
import { findInteractiveSceneObject } from "./find-interactive-scene-object";

/** The caller supplies distance-sorted hits. Never look through the first hit. */
export function findHoveredSceneObject(
  intersections: readonly Intersection[],
): Object3D | null {
  return findInteractiveSceneObject(intersections, HOVERABLE);
}
