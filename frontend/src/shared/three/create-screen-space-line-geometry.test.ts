import { expect, test } from "vitest";

import { createScreenSpaceLineGeometry } from "./create-screen-space-line-geometry";

test("creates an unlit-mesh-ready tube with round end caps", () => {
  const radius = 0.1;
  const geometry = createScreenSpaceLineGeometry(
    [
      [0, 0, 0],
      [1, 0, 0],
    ],
    radius,
  );
  geometry.computeBoundingBox();

  expect(geometry.getAttribute("position").count).toBeGreaterThan(0);
  expect(geometry.boundingBox?.min.x).toBeCloseTo(-radius, 2);
  expect(geometry.boundingBox?.max.x).toBeCloseTo(1 + radius, 2);
  geometry.dispose();
});
