import { describe, expect, it } from "vitest";

import { weightedMedianFocusDistance } from "./weighted-median-focus-distance";

describe("weightedMedianFocusDistance", () => {
  it("prefers the center-weighted sample over distant outliers", () => {
    expect(
      weightedMedianFocusDistance([
        { distance: 2, weight: 6 },
        { distance: 10, weight: 1 },
        { distance: 12, weight: 1 },
      ]),
    ).toBe(2);
  });

  it("returns null without hits", () => {
    expect(weightedMedianFocusDistance([])).toBeNull();
  });
});
