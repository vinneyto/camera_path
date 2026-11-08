import type { PerspectiveCamera } from "three";

export function applyFreeFlightProjection(camera: PerspectiveCamera) {
  if (
    camera.near === 0.01 &&
    camera.far === 100 &&
    camera.fov === 50 &&
    camera.zoom === 1
  )
    return;
  camera.near = 0.01;
  camera.far = 100;
  camera.fov = 50;
  camera.zoom = 1;
  camera.updateProjectionMatrix();
}
