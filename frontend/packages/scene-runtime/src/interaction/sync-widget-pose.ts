import { Quaternion, type Object3D } from "three";
import type { WidgetPose } from "./widget-types";

export function syncWidgetPose(
  proxy: Object3D,
  { transform, parentMatrix, parentRotation }: WidgetPose,
) {
  proxy.position.fromArray(transform.position).applyMatrix4(parentMatrix);
  proxy.quaternion
    .copy(parentRotation)
    .multiply(new Quaternion(...transform.quaternion))
    .normalize();
  proxy.scale.setScalar(1);
  proxy.updateMatrixWorld(true);
}
