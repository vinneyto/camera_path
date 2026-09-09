import { describe, expect, it } from "vitest";
import { Vector3 } from "three";

import type {
  CompiledTrajectory,
  ResolvedCameraAim,
} from "@/entities/trajectory/model/types";

import { evaluateTrajectoryCameraPose } from "./evaluate-trajectory-camera-pose";

function createTrajectory(aim: ResolvedCameraAim): CompiledTrajectory {
  const keyframes = aim.kind === "look_at_point"
    ? [{
        id: "aim",
        path_position: 0,
        aim,
        interpolation_to_next: "smoothstep" as const,
      }]
    : [];
  return {
    project_id: "project",
    revision: 1,
    position_segments: [{
      source_segment_id: "segment",
      p0: [0, 0, 0],
      p1: [1 / 3, 0, 0],
      p2: [2 / 3, 0, 0],
      p3: [1, 0, 0],
      length: 1,
    }],
    arc_length_table: [
      { segment_index: 0, t: 0, distance: 0 },
      { segment_index: 0, t: 1, distance: 1 },
    ],
    total_length: 1,
    duration_seconds: 1,
    motion_profile: { default_speed: 1, keyframes: [] },
    camera_track: {
      default_aim: { kind: "follow_path", direction: "forward" },
      keyframes,
      world_up: [0, 1, 0],
    },
    warnings: [],
  };
}

describe("evaluateTrajectoryCameraPose", () => {
  it("places the camera on the path and looks along a follow-path aim", () => {
    const pose = evaluateTrajectoryCameraPose(
      createTrajectory({ kind: "follow_path", direction: "forward" }),
      0.5,
    );
    const forward = new Vector3(0, 0, -1).applyQuaternion(pose.quaternion);

    expect(pose.position.toArray()).toEqual([0.5, 0, 0]);
    expect(forward.distanceTo(new Vector3(1, 0, 0))).toBeLessThan(1e-8);
  });

  it("uses the resolved look-at point for orientation", () => {
    const pose = evaluateTrajectoryCameraPose(
      createTrajectory({ kind: "look_at_point", scene_point_id: "target", position: [0.5, 1, -1] }),
      0.5,
    );
    const forward = new Vector3(0, 0, -1).applyQuaternion(pose.quaternion);
    const expected = new Vector3(0, 1, -1).normalize();

    expect(forward.distanceTo(expected)).toBeLessThan(1e-8);
  });

  it("keeps the final explicit aim active through the end of the path", () => {
    const trajectory = createTrajectory({
      kind: "look_at_point",
      scene_point_id: "target",
      position: [0.5, 1, -1],
    });

    const pose = evaluateTrajectoryCameraPose(trajectory, 1);
    const forward = new Vector3(0, 0, -1).applyQuaternion(pose.quaternion);
    const expected = new Vector3(-0.5, 1, -1).normalize();

    expect(forward.distanceTo(expected)).toBeLessThan(1e-8);
  });
});
