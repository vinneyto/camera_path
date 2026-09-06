import type { OrbitControls } from "three-stdlib";

export function stopOrbitControlsInertia(controls: OrbitControls): void {
  const camera = controls.object;
  const position = camera.position.clone();
  const quaternion = camera.quaternion.clone();
  const target = controls.target.clone();
  const zoom = camera.zoom;
  const enableDamping = controls.enableDamping;

  controls.enableDamping = false;
  controls.update();

  camera.position.copy(position);
  camera.quaternion.copy(quaternion);
  camera.zoom = zoom;
  camera.updateProjectionMatrix();
  controls.target.copy(target);
  controls.update();
  controls.enableDamping = enableDamping;
}
