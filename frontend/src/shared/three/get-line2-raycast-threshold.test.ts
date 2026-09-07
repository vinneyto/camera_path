import { expect, test } from "vitest";

import { getLine2RaycastThreshold } from "./get-line2-raycast-threshold";

test("converts CSS-pixel line width and hit slop to the Line2 pixel threshold", () => {
  expect(getLine2RaycastThreshold(3, 6.5, 1)).toBe(13);
  expect(getLine2RaycastThreshold(3, 6.5, 2)).toBe(29);
  expect(getLine2RaycastThreshold(3, -1, 2)).toBe(3);
});
