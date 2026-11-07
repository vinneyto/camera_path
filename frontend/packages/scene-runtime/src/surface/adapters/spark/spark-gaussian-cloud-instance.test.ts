import type { SplatMesh } from "@sparkjsdev/spark";
import { Box3, Color, Object3D, Vector3 } from "three";
import { expect, it, vi } from "vitest";
import { SparkGaussianCloudInstance } from "./spark-gaussian-cloud-instance";

it("restores the original color after repeated hover transitions", () => {
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
  instance.setHovered(true);
  instance.setHovered(true);
  expect(mesh.recolor.r).toBeCloseTo(original.r * 1.18);
  instance.setHovered(false);
  instance.setHovered(false);
  expect(mesh.recolor.r).toBeCloseTo(original.r);
  expect(mesh.recolor.g).toBeCloseTo(original.g);
  expect(mesh.recolor.b).toBeCloseTo(original.b);
});
