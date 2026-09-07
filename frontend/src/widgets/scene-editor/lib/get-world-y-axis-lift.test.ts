import { describe, expect, it } from "vitest";
import { Ray, Vector3 } from "three";

import { getWorldYAxisLift } from "./get-world-y-axis-lift";

describe("getWorldYAxisLift", () => {
  it("projects a pointer ray onto the anchor's vertical axis", () => {
    const ray = new Ray(new Vector3(1, 2, 5), new Vector3(0, 0, -1));

    expect(getWorldYAxisLift(ray, [0, 0, 0])).toBeCloseTo(2);
  });

  it("clamps the anchor to its surface", () => {
    const ray = new Ray(new Vector3(0, -1, 5), new Vector3(0, 0, -1));

    expect(getWorldYAxisLift(ray, [0, 0, 0])).toBe(0);
  });

  it("ignores a ray parallel to the vertical axis", () => {
    const ray = new Ray(new Vector3(0, 2, 0), new Vector3(0, -1, 0));

    expect(getWorldYAxisLift(ray, [0, 0, 0])).toBeNull();
  });
});
