import { describe, expect, it } from "vitest";
import { Vector3 } from "three";

import type {
  CompiledTrajectory,
  ResolvedCameraAim,
} from "@/entities/trajectory/model/types";

import { evaluateTrajectoryCameraPose } from "./evaluate-trajectory-camera-pose";

function createTrajectory(aim: ResolvedCameraAim): CompiledTrajectory {
  const keyframes = [
    {
      id: "aim",
      path_position: 0,
      aim,
      interpolation_to_next: "smoothstep" as const,
    },
  ];
  return {
    project_id: "project",
    revision: 1,
    position_segments: [
      {
        source_segment_id: "segment",
        p0: [0, 0, 0],
        p1: [1 / 3, 0, 0],
        p2: [2 / 3, 0, 0],
        p3: [1, 0, 0],
        length: 1,
      },
    ],
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
      default_orientation: { yaw_deg: 0, pitch_deg: 0, roll_deg: 0 },
      orientation_keyframes: [],
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
      createTrajectory({
        kind: "look_at_point",
        scene_point_id: "target",
        position: [0.5, 1, -1],
      }),
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

  it("applies yaw, pitch and roll in the local camera frame", () => {
    const yawTrajectory = createTrajectory({
      kind: "follow_path",
      direction: "forward",
    });
    yawTrajectory.camera_track.default_orientation.yaw_deg = 90;
    const yawForward = new Vector3(0, 0, -1).applyQuaternion(
      evaluateTrajectoryCameraPose(yawTrajectory, 0.5).quaternion,
    );
    expect(yawForward.distanceTo(new Vector3(0, 0, -1))).toBeLessThan(1e-8);

    const pitchTrajectory = createTrajectory({
      kind: "follow_path",
      direction: "forward",
    });
    pitchTrajectory.camera_track.default_orientation.pitch_deg = 90;
    const pitchForward = new Vector3(0, 0, -1).applyQuaternion(
      evaluateTrajectoryCameraPose(pitchTrajectory, 0.5).quaternion,
    );
    expect(pitchForward.distanceTo(new Vector3(0, 1, 0))).toBeLessThan(1e-8);

    const rollTrajectory = createTrajectory({
      kind: "follow_path",
      direction: "forward",
    });
    rollTrajectory.camera_track.default_orientation.roll_deg = 90;
    const rollUp = evaluateTrajectoryCameraPose(rollTrajectory, 0.5).up;
    expect(rollUp.distanceTo(new Vector3(0, 0, 1))).toBeLessThan(1e-8);
  });

  it("builds a stable frame when world up is collinear with the view direction", () => {
    const trajectory = createTrajectory({
      kind: "look_at_point",
      scene_point_id: "target",
      position: [0.5, 1, 0],
    });
    const pose = evaluateTrajectoryCameraPose(trajectory, 0.5);
    const values = [...pose.quaternion.toArray(), ...pose.up.toArray()];

    expect(values.every(Number.isFinite)).toBe(true);
    expect(
      new Vector3(0, 0, -1)
        .applyQuaternion(pose.quaternion)
        .distanceTo(new Vector3(0, 1, 0)),
    ).toBeLessThan(1e-8);
  });
});
