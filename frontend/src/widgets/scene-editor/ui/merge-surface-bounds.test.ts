import { expect, it } from "vitest";

import { mergeSurfaceBounds } from "./merge-surface-bounds";

it("encloses all initial cloud bounds before framing", () => {
  const combined = mergeSurfaceBounds([
    { center: [-5, 0, 0], radius: 1 },
    { center: [5, 0, 0], radius: 1 },
  ]);

  expect(combined?.center).toEqual([0, 0, 0]);
  expect(combined?.radius).toBe(6);
  expect(mergeSurfaceBounds([])).toBeNull();
});
