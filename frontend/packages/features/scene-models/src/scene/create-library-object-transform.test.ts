import { expect, it } from "vitest";
import type { LibraryAsset } from "@camera-path/types/api";
import { createLibraryObjectTransform } from "./create-library-object-transform";

it("preserves placement when folding the library's model offset into local position", () => {
  const asset = {
    default_rotation_deg: [0, 0, 90],
    default_scale: 2,
    default_offset: [1, 0, 0],
  } as LibraryAsset;
  const pose = createLibraryObjectTransform(asset, [10, 20, 30]);
  expect(pose.position[0]).toBeCloseTo(10);
  expect(pose.position[1]).toBeCloseTo(22);
  expect(pose.position[2]).toBeCloseTo(30);
  expect(pose.quaternion[2]).toBeCloseTo(Math.SQRT1_2);
  expect(pose.scale).toEqual([2, 2, 2]);
  expect(asset.default_offset).toEqual([1, 0, 0]);
});
