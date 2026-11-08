import type { SplatMesh } from "@sparkjsdev/spark";
import { Box3, Color, Object3D, Vector3 } from "three";
import { expect, it, vi } from "vitest";
import { SparkGaussianCloudInstance } from "./spark-gaussian-cloud-instance";
import { GAUSSIAN_HOVER_GAIN, GAUSSIAN_SELECTED_GAIN } from "../../constants";

it("prioritizes selection over hover and restores the original color", () => {
  const mesh = Object.assign(new Object3D(), {
    recolor: new Color(0.4, 0.5, 0.6),
    getBoundingBox: () =>
      new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1)),
    dispose: vi.fn(),
  });
  const original = mesh.recolor.clone();
  const instance = new SparkGaussianCloudInstance(
    mesh as unknown as SplatMesh,
    vi.fn(),
  );
  instance.setInteractionState(true, false);
  instance.setInteractionState(true, false);
  expect(mesh.recolor.r).toBeCloseTo(original.r * GAUSSIAN_HOVER_GAIN);
  instance.setInteractionState(true, true);
  expect(mesh.recolor.r).toBeCloseTo(original.r * GAUSSIAN_SELECTED_GAIN);
  instance.setInteractionState(false, true);
  expect(mesh.recolor.r).toBeCloseTo(original.r * GAUSSIAN_SELECTED_GAIN);
  instance.setInteractionState(true, false);
  expect(mesh.recolor.r).toBeCloseTo(original.r * GAUSSIAN_HOVER_GAIN);
  instance.setInteractionState(false, false);
  instance.setInteractionState(false, false);
  expect(mesh.recolor.r).toBeCloseTo(original.r);
  expect(mesh.recolor.g).toBeCloseTo(original.g);
  expect(mesh.recolor.b).toBeCloseTo(original.b);
});
