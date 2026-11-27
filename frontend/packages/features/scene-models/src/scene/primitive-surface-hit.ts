import type { ThreeEvent } from "@react-three/fiber";
import { Matrix3, Vector3 } from "three";
import type { SceneSurfaceHit } from "@camera-path/scene-runtime/surface/model/scene-surface-types";

export function primitiveSurfaceHit(
  event: ThreeEvent<PointerEvent>,
): SceneSurfaceHit {
  const normal = (
    event.face?.normal.clone() ?? new Vector3(0, 1, 0)
  ).applyNormalMatrix(new Matrix3().getNormalMatrix(event.object.matrixWorld));
  return { position: event.point.toArray(), normal: normal.toArray() };
}
