import { describe, expect, it } from "vitest";
import { OrthographicCamera, PerspectiveCamera } from "three";

import { getCameraScaledHtmlScale } from "./get-camera-scaled-html-scale";

describe("getCameraScaledHtmlScale", () => {
  it("matches perspective distance scaling immediately for near and far markers", () => {
    const camera = new PerspectiveCamera(60, 1, 0.1, 100);

    expect(getCameraScaledHtmlScale(camera, 2, 8)).toBeCloseTo(2 * Math.sqrt(3));
    expect(getCameraScaledHtmlScale(camera, 8, 8)).toBeCloseTo(Math.sqrt(3) / 2);
  });

  it("uses the current perspective FOV", () => {
    const camera = new PerspectiveCamera(30, 1, 0.1, 100);
    const narrowFovScale = getCameraScaledHtmlScale(camera, 5, 8);

    camera.fov = 75;

    expect(getCameraScaledHtmlScale(camera, 5, 8)).toBeLessThan(narrowFovScale);
  });

  it("uses orthographic zoom independently of distance", () => {
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    camera.zoom = 2;

    expect(getCameraScaledHtmlScale(camera, 2, 8)).toBe(16);
    expect(getCameraScaledHtmlScale(camera, 20, 8)).toBe(16);
  });
});
