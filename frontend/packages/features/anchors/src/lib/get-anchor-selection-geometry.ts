import type { Vec3 } from "@camera-path/types/project";
import { Quaternion, Vector3 } from "three";
import {
  ANCHOR_SELECTION_COLLAPSED_RADIUS,
  ANCHOR_SELECTION_MIDPOINT,
  ANCHOR_SELECTION_MIN_HEIGHT,
  ANCHOR_SELECTION_RADIUS,
} from "../constants";

/** Coordinates are local to the upper marker; the base is at surfaceOffset. */
export function getAnchorSelectionGeometry(surfaceOffset: Vec3) {
  const direction = new Vector3(...surfaceOffset).negate();
  const length = direction.length();
  const quaternion = new Quaternion();
  if (length > 0)
    quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize());
  return {
    position: surfaceOffset.map(
      (component) => component * ANCHOR_SELECTION_MIDPOINT,
    ) as Vec3,
    quaternion: quaternion.toArray(),
    height: Math.max(length, ANCHOR_SELECTION_MIN_HEIGHT),
    // A collapsed anchor still has a selectable rim outside its height-drag handle.
    radius:
      length < ANCHOR_SELECTION_MIN_HEIGHT
        ? ANCHOR_SELECTION_COLLAPSED_RADIUS
        : ANCHOR_SELECTION_RADIUS,
  };
}
