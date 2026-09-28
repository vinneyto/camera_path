import { expect, it } from "vitest";

import type { ProjectCloud } from "@/shared/api/generated/model";

import { transformProjectCloudBounds } from "./transform-project-cloud-bounds";

it("applies the cloud offset, scale, rotation, and translation to its bounds", () => {
  const cloud = {
    offset: [0, 0, 1],
    scale: 2,
    rotation_deg: [0, 90, 0],
    translation: [10, 0, 0],
  } as ProjectCloud;
  const result = transformProjectCloudBounds(
    { center: [1, 0, 0], radius: 3, min: [0, -1, -1], max: [2, 1, 1] },
    cloud,
  );

  expect(result.center[0]).toBeCloseTo(12);
  expect(result.center[1]).toBeCloseTo(0);
  expect(result.center[2]).toBeCloseTo(-2);
  expect(result.radius).toBe(6);
  expect(result.min?.[0]).toBeCloseTo(10);
  expect(result.max?.[0]).toBeCloseTo(14);
  expect(result.min?.[2]).toBeCloseTo(-4);
  expect(result.max?.[2]).toBeCloseTo(0);
});
