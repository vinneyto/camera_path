import { describe, expect, it } from "vitest";

import type { CompiledTrajectory, CubicBezier3D } from "../model/types";

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

function createServerArcTable(segment: CubicBezier3D, steps = 64) {
  const distances = [0];
  let previous = evaluateBezier(segment, 0);
  for (let index = 1; index <= steps; index += 1) {
    const point = evaluateBezier(segment, index / steps);
    distances.push(distances.at(-1)! + point.distanceTo(previous));
    previous = point;
  }
  const scale = segment.length / distances.at(-1)!;
  return distances.map((distance, index) => ({
    segment_index: 0,
    t: index / steps,
    distance: distance * scale,
  }));
}

const trajectory = {
  position_segments: [curve],
  arc_length_table: createServerArcTable(curve),
  total_length: curve.length,
} as unknown as CompiledTrajectory;

describe("locateOnPath", () => {
  it("maps normalized distance to Bezier t through the compiled arc-length table", () => {
    const halfT = trajectory.arc_length_table.find((sample) => sample.t === 0.5)!;
    const sample = locateOnPath(trajectory, halfT.distance / curve.length);
    const expected = evaluateBezier(curve, 0.5);

    expect(sample.position.distanceTo(expected)).toBeLessThan(1e-8);
  });

  it("keeps path endpoints exact", () => {
    expect(locateOnPath(trajectory, 0).position.toArray()).toEqual(curve.p0);
    expect(locateOnPath(trajectory, 1).position.toArray()).toEqual(curve.p3);
  });

  it("handles a segment boundary without a duplicate start sample", () => {
    const straight = (id: string, start: number, end: number): CubicBezier3D => ({
      source_segment_id: id,
      p0: [start, 0, 0],
      p1: [start + (end - start) / 3, 0, 0],
      p2: [start + 2 * (end - start) / 3, 0, 0],
      p3: [end, 0, 0],
      length: end - start,
    });
    const twoSegments = {
      position_segments: [straight("a", 0, 1), straight("b", 1, 2)],
      arc_length_table: [
        { segment_index: 0, t: 0, distance: 0 },
        { segment_index: 0, t: 1, distance: 1 },
        { segment_index: 1, t: 1, distance: 2 },
      ],
      total_length: 2,
    } as unknown as CompiledTrajectory;

    expect(locateOnPath(twoSegments, 0.5).position.toArray()).toEqual([1, 0, 0]);
    expect(locateOnPath(twoSegments, 0.75).position.x).toBeCloseTo(1.5);
  });
});
