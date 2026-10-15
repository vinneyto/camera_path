import { describe, expect, it } from "vitest";

import { createPlaybackTable } from "@camera-path/trajectory-math/lib/create-playback-table";
import { evaluateSpeed } from "@camera-path/trajectory-math/lib/evaluate-speed";
import { pathPositionAtTime } from "@camera-path/trajectory-math/lib/path-position-at-time";
import { timeAtPathPosition } from "@camera-path/trajectory-math/lib/time-at-path-position";
import type { CompiledTrajectory } from "@camera-path/types/trajectory";

const trajectory = {
  total_length: 10,
  duration_seconds: 7,
  motion_profile: {
    default_speed: 2,
    keyframes: [
      {
        id: "slow",
        path_position: 0.5,
        speed: 1,
        interpolation_to_next: "linear",
      },
    ],
  },
} as CompiledTrajectory;

describe("speed profile", () => {
  it("interpolates between default and explicit controls", () => {
    expect(evaluateSpeed(trajectory, 0)).toBe(2);
    expect(evaluateSpeed(trajectory, 0.5)).toBe(1);
    expect(evaluateSpeed(trajectory, 1)).toBe(2);
  });

  it("builds an invertible time table", () => {
    const table = createPlaybackTable(trajectory, 256);
    expect(table.at(-1)?.time).toBe(trajectory.duration_seconds);
    const halfTime = (table.at(-1)?.time ?? 0) / 2;
    const midpoint = pathPositionAtTime(table, halfTime);
    expect(midpoint).toBeGreaterThan(0.4);
    expect(midpoint).toBeLessThan(0.6);
    expect(timeAtPathPosition(table, midpoint)).toBeCloseTo(halfTime, 8);
  });
});
