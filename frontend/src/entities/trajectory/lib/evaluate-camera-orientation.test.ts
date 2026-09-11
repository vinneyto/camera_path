import { describe, expect, it } from "vitest";

import type { CompiledTrajectory } from "@/entities/trajectory/model/types";

import { evaluateCameraOrientation } from "./evaluate-camera-orientation";

function createTrajectory(): CompiledTrajectory {
  return {
    project_id: "project",
    revision: 1,
    position_segments: [],
    arc_length_table: [],
    total_length: 0,
    duration_seconds: 0,
    motion_profile: { default_speed: 1, keyframes: [] },
    camera_track: {
      default_aim: { kind: "follow_path", direction: "forward" },
      keyframes: [],
      default_orientation: { yaw_deg: 0, pitch_deg: 0, roll_deg: 0 },
      orientation_keyframes: [],
      world_up: [0, 1, 0],
    },
    warnings: [],
  };
}

describe("evaluateCameraOrientation", () => {
  it("returns the default orientation without keyframes", () => {
    const trajectory = createTrajectory();
    trajectory.camera_track.default_orientation = {
      yaw_deg: 2,
      pitch_deg: 3,
      roll_deg: 4,
    };

    expect(evaluateCameraOrientation(trajectory, 0.5)).toEqual({
      yaw_deg: 2,
      pitch_deg: 3,
      roll_deg: 4,
    });
  });

  it("interpolates unwrapped degrees instead of taking a shortest quaternion path", () => {
    const trajectory = createTrajectory();
    trajectory.camera_track.orientation_keyframes = [
      {
        id: "start",
        path_position: 0,
        orientation: { yaw_deg: 0, pitch_deg: 0, roll_deg: 0 },
        interpolation_to_next: "linear",
      },
      {
        id: "end",
        path_position: 1,
        orientation: { yaw_deg: 360, pitch_deg: -20, roll_deg: 10 },
        interpolation_to_next: "linear",
      },
    ];

    expect(evaluateCameraOrientation(trajectory, 0.5)).toEqual({
      yaw_deg: 180,
      pitch_deg: -10,
      roll_deg: 5,
    });
  });

  it("jumps to the next value at the end of a hold segment", () => {
    const trajectory = createTrajectory();
    trajectory.camera_track.orientation_keyframes = [
      {
        id: "start",
        path_position: 0,
        orientation: { yaw_deg: 10, pitch_deg: 0, roll_deg: 0 },
        interpolation_to_next: "hold",
      },
      {
        id: "end",
        path_position: 0.5,
        orientation: { yaw_deg: 20, pitch_deg: 0, roll_deg: 0 },
        interpolation_to_next: "linear",
      },
    ];

    expect(evaluateCameraOrientation(trajectory, 0.499).yaw_deg).toBe(10);
    expect(evaluateCameraOrientation(trajectory, 0.5).yaw_deg).toBe(20);
  });
});
