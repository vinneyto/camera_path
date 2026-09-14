import { describe, expect, it } from "vitest";
import { Group, PerspectiveCamera, Vector3 } from "three";

import { getCameraForwardNdc } from "./get-camera-forward-ndc";

describe("getCameraForwardNdc", () => {
  it("returns the canvas center for a centered projection", () => {
    const camera = new PerspectiveCamera(42, 1.5, 0.01, 100);

    const center = getCameraForwardNdc(camera, new Vector3());

    expect(center.x).toBeCloseTo(0);
    expect(center.y).toBeCloseTo(0);
  });

  it("follows the principal point when the camera view is offset", () => {
    const camera = new PerspectiveCamera(42, 1.5, 0.01, 100);
    camera.setViewOffset(1200, 800, 0, 100, 1200, 800);

    const center = getCameraForwardNdc(camera, new Vector3());

    expect(center.x).toBeCloseTo(0);
    expect(center.y).toBeCloseTo(0.25);
  });

  it("supports cameras transformed by a parent", () => {
    const parent = new Group();
    const camera = new PerspectiveCamera(42, 1.5, 0.01, 100);
    parent.position.set(3, 2, 1);
    parent.rotation.set(0.2, 0.4, 0.1);
    parent.add(camera);

    const center = getCameraForwardNdc(camera, new Vector3());

    expect(center.x).toBeCloseTo(0);
    expect(center.y).toBeCloseTo(0);
  });
});
