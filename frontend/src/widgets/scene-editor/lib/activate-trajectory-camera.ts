import type { PerspectiveCamera } from "three";

const TRAJECTORY_CAMERA_FOV = 50;
const TRAJECTORY_CAMERA_NEAR = 0.01;
const TRAJECTORY_CAMERA_FAR = 100;

export function activateTrajectoryCamera(
  camera: PerspectiveCamera,
): () => void {
  const saved = {
    far: camera.far,
    fov: camera.fov,
    near: camera.near,
    position: camera.position.clone(),
    quaternion: camera.quaternion.clone(),
    up: camera.up.clone(),
    zoom: camera.zoom,
  };
  camera.far = TRAJECTORY_CAMERA_FAR;
  camera.fov = TRAJECTORY_CAMERA_FOV;
  camera.near = TRAJECTORY_CAMERA_NEAR;
  camera.zoom = 1;
  camera.updateProjectionMatrix();

  return () => {
    camera.far = saved.far;
    camera.fov = saved.fov;
    camera.near = saved.near;
    camera.position.copy(saved.position);
    camera.quaternion.copy(saved.quaternion);
    camera.up.copy(saved.up);
    camera.zoom = saved.zoom;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  };
}
