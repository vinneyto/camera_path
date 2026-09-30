import { expect, it } from "vitest";

import { mergeSurfaceBounds } from "./merge-surface-bounds";

it("encloses all initial cloud bounds before framing", () => {
  const combined = mergeSurfaceBounds([
    { center: [-5, 0, 0], radius: 1 },
    { center: [5, 0, 0], radius: 1 },
  ]);

  expect(combined?.center).toEqual([0, 0, 0]);
  expect(combined?.radius).toBe(6);
  expect(combined?.min).toEqual([-6, -1, -1]);
  expect(combined?.max).toEqual([6, 1, 1]);
  expect(mergeSurfaceBounds([])).toBeNull();
});

it("merges exact boxes from loaded clouds", () => {
  const combined = mergeSurfaceBounds([
    { center: [-5, 0, 0], radius: 2, min: [-6, -1, -1], max: [-4, 1, 1] },
    { center: [5, 0, 0], radius: 2, min: [4, -1, -1], max: [6, 1, 1] },
  ]);

  expect(combined?.min).toEqual([-6, -1, -1]);
  expect(combined?.max).toEqual([6, 1, 1]);
});
