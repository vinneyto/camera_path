import { PerspectiveCamera } from "three";
import { OrbitControls } from "three-stdlib";
import { expect, it } from "vitest";

import { stopOrbitControlsInertia } from "./stop-orbit-controls-inertia";

it("clears damping without moving the camera or target", () => {
  const camera = new PerspectiveCamera(42, 1, 0.01, 100);
  camera.position.set(0, 0, 5);
  const controls = new OrbitControls(camera);
  controls.enableDamping = true;
  controls.setAzimuthalAngle(controls.getAzimuthalAngle() + 0.5);
  const position = camera.position.clone();
  const quaternion = camera.quaternion.clone();
  const target = controls.target.clone();

  stopOrbitControlsInertia(controls);
  controls.update();

  expect(camera.position.distanceTo(position)).toBeLessThan(1e-10);
  expect(1 - Math.abs(camera.quaternion.dot(quaternion))).toBeLessThan(1e-10);
  expect(controls.target.distanceTo(target)).toBeLessThan(1e-10);
});
