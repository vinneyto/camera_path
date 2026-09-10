import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";

import { applyCameraViewOffset } from "./apply-camera-view-offset";

const VIEWPORT_WIDTH = 1200;
const VIEWPORT_HEIGHT = 800;

function projectedScreenY(camera: PerspectiveCamera) {
  const projected = new Vector3(0, 0, -1).project(camera);
  return ((1 - projected.y) * VIEWPORT_HEIGHT) / 2;
}

describe("applyCameraViewOffset", () => {
  it("moves the principal point to the center of the unobscured height", () => {
    const camera = new PerspectiveCamera(
      42,
      VIEWPORT_WIDTH / VIEWPORT_HEIGHT,
      0.01,
      100,
    );

    applyCameraViewOffset(camera, VIEWPORT_WIDTH, VIEWPORT_HEIGHT, 200);

    expect(projectedScreenY(camera)).toBeCloseTo(300);
  });

  it("restores the centered projection without accumulating an offset", () => {
    const camera = new PerspectiveCamera(
      42,
      VIEWPORT_WIDTH / VIEWPORT_HEIGHT,
      0.01,
      100,
    );

    applyCameraViewOffset(camera, VIEWPORT_WIDTH, VIEWPORT_HEIGHT, 200);
    applyCameraViewOffset(camera, VIEWPORT_WIDTH, VIEWPORT_HEIGHT, 0);
    applyCameraViewOffset(camera, VIEWPORT_WIDTH, VIEWPORT_HEIGHT, 0);

    expect(camera.view?.enabled).toBe(false);
    expect(projectedScreenY(camera)).toBeCloseTo(VIEWPORT_HEIGHT / 2);
  });

  it("clamps an overlay taller than the viewport", () => {
    const camera = new PerspectiveCamera(
      42,
      VIEWPORT_WIDTH / VIEWPORT_HEIGHT,
      0.01,
      100,
    );

    applyCameraViewOffset(
      camera,
      VIEWPORT_WIDTH,
      VIEWPORT_HEIGHT,
      VIEWPORT_HEIGHT * 2,
    );

    expect(projectedScreenY(camera)).toBeCloseTo(0);
  });
});
