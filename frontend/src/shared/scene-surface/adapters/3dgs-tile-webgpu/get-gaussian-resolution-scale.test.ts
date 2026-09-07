import { describe, expect, it } from "vitest";

import { getGaussianResolutionScale } from "./get-gaussian-resolution-scale";

describe("getGaussianResolutionScale", () => {
  it("keeps one physical Gaussian pixel per CSS pixel in 1x mode", () => {
    expect(getGaussianResolutionScale("1x", 1)).toBe(1);
    expect(getGaussianResolutionScale("1x", 2)).toBe(0.5);
    expect(getGaussianResolutionScale("1x", 1.25)).toBe(0.8);
  });

  it("uses the full drawing buffer in system mode", () => {
    expect(getGaussianResolutionScale("system", 1)).toBe(1);
    expect(getGaussianResolutionScale("system", 2)).toBe(1);
  });

  it("rejects invalid system DPR values", () => {
    expect(() => getGaussianResolutionScale("1x", 0)).toThrow(RangeError);
    expect(() => getGaussianResolutionScale("1x", Number.NaN)).toThrow(
      RangeError,
    );
  });
});
