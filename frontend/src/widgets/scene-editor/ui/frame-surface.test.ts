import { PerspectiveCamera, Vector3 } from "three/webgpu";
import { expect, it } from "vitest";

import { frameSurface } from "./frame-surface";

it("fits a bounding sphere within the narrower camera FOV", () => {
  const camera = new PerspectiveCamera(42, 0.5, 0.01, 100);
  camera.zoom = 2;
  camera.position.set(4, 3, 6);
  camera.lookAt(0, 0, 0);
  const direction = camera.getWorldDirection(new Vector3());
  let target: [number, number, number] | undefined;

  frameSurface(camera, { center: [10, 2, -3], radius: 2 }, (next) => {
    target = next;
  });

  const distance = camera.position.distanceTo(new Vector3(10, 2, -3));
  const verticalHalfFov = Math.atan(Math.tan((42 * Math.PI) / 360) / 2);
  const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * 0.5);
  expect(Math.asin(2 / distance)).toBeLessThan(horizontalHalfFov);
  expect(camera.getWorldDirection(new Vector3()).dot(direction)).toBeCloseTo(1);
  expect(camera.near).toBeLessThan(distance - 2);
  expect(camera.far).toBeGreaterThan(distance + 2);
  expect(target).toEqual([10, 2, -3]);
});
