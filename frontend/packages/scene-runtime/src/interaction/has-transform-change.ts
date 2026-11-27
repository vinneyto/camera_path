import type { SceneObjectTransform } from "@camera-path/types/scene-object-transform";
import { Quaternion, Vector3 } from "three";
import { TRANSFORM_EPSILON } from "./constants";

export function hasTransformChange(
  before: SceneObjectTransform,
  after: SceneObjectTransform,
) {
  return (
    new Vector3(...before.position).distanceTo(new Vector3(...after.position)) >
      TRANSFORM_EPSILON ||
    1 -
      Math.abs(
        new Quaternion(...before.quaternion).dot(
          new Quaternion(...after.quaternion),
        ),
      ) >
      TRANSFORM_EPSILON
  );
}
