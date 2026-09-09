import { describe, expect, it } from "vitest";

import { isGaussianSurfacePickActive } from "./is-gaussian-surface-pick-active";

describe("isGaussianSurfacePickActive", () => {
  it.each([
    ["anchor", true],
    ["anchor-height", false],
    [null, false],
  ] as const)("maps %s to %s", (activeTool, expected) => {
    expect(isGaussianSurfacePickActive(activeTool)).toBe(expected);
  });
});
