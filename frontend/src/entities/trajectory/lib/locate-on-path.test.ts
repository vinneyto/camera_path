import { describe, expect, it } from "vitest";

import type { CompiledTrajectory, CubicBezier3D } from "../model/types";

import { createArcLengthTable } from "./create-arc-length-table";
import { evaluateBezier } from "./evaluate-bezier";
import { locateOnPath } from "./locate-on-path";

const curve: CubicBezier3D = {
  source_segment_id: "curve",
  p0: [0, 0, 0],
  p1: [8, 0, 0],
  p2: [0, 1, 0],
  p3: [0, 2, 0],
  length: 6.43,
};

const trajectory = {
  position_segments: [curve],
  total_length: curve.length,
} as unknown as CompiledTrajectory;

describe("locateOnPath", () => {
  it("maps normalized distance to Bezier t through the arc-length table", () => {
    const table = createArcLengthTable(trajectory);
    const halfT = table.find((sample) => sample.t === 0.5)!;
    const sample = locateOnPath(trajectory, halfT.distance / curve.length);
    const expected = evaluateBezier(curve, 0.5);

    expect(sample.position.distanceTo(expected)).toBeLessThan(1e-8);
  });

  it("keeps path endpoints exact", () => {
    expect(locateOnPath(trajectory, 0).position.toArray()).toEqual(curve.p0);
    expect(locateOnPath(trajectory, 1).position.toArray()).toEqual(curve.p3);
  });
});
