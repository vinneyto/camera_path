import { expect, test } from "vitest";

import { normalizeScreenSpaceLinePoints } from "./normalize-screen-space-line-points";

test("removes only consecutive duplicate and near-duplicate line points", () => {
  const points = normalizeScreenSpaceLinePoints([
    [0, 0, 0],
    [0, 0, 0],
    [0.0000001, 0, 0],
    [1, 0, 0],
    [0, 0, 0],
  ]);

  expect(points.map((point) => point.toArray())).toEqual([
    [0, 0, 0],
    [1, 0, 0],
    [0, 0, 0],
  ]);
});
