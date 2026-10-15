import type { Camera, Vector3 } from "three";

export function getCameraForwardNdc(camera: Camera, target: Vector3): Vector3 {
  camera.updateWorldMatrix(true, false);
  return target.set(0, 0, -1).applyMatrix4(camera.matrixWorld).project(camera);
}
