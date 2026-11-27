import type { SceneObjectTransform } from "@camera-path/types/scene-object-transform";
import type { SceneWidgetMode } from "@camera-path/types/editor-state";
import { Quaternion, type Object3D } from "three";
import type { WidgetPose } from "./widget-types";

/** Read only the edited local component. Never decompose a scaled/sheared world matrix. */
export function readWidgetTransform(
  proxy: Object3D,
  pose: WidgetPose,
  mode: SceneWidgetMode,
): SceneObjectTransform {
  const { transform, parentMatrix, parentRotation } = pose;
  return {
    position:
      mode === "position"
        ? proxy.position
            .clone()
            .applyMatrix4(parentMatrix.clone().invert())
            .toArray()
        : [...transform.position],
    quaternion:
      mode === "rotation"
        ? parentRotation
            .clone()
            .invert()
            .multiply(proxy.quaternion)
            .normalize()
            .toArray()
        : new Quaternion(...transform.quaternion).normalize().toArray(),
    scale: [...transform.scale],
  };
}
