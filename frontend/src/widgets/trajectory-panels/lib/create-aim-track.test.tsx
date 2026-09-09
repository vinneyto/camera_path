import { describe, expect, it } from "vitest";

import type { Project } from "@/entities/project";
import type { CompiledTrajectory } from "@/entities/trajectory";

import { createAimTrack } from "./create-aim-track";

const project: Project = {
  anchors: {},
  camera_track: {
    default_aim: { kind: "follow_path", direction: "forward" },
    keyframes: {},
    world_up: [0, 1, 0],
  },
  chat_history: [],
  id: "project",
  motion_profile: { default_speed: 1, keyframes: {} },
  name: "Project",
  revision: 1,
  scene_points: {
    target: { id: "target", label: "Subject", position: [0, 1, 0] },
  },
  segments: [],
};

function createTrajectory(keyframes: CompiledTrajectory["camera_track"]["keyframes"]) {
  return {
    camera_track: {
      default_aim: { kind: "follow_path", direction: "forward" },
      keyframes,
    },
  } as CompiledTrajectory;
}

describe("createAimTrack", () => {
  it("uses a compact follow-path empty state", () => {
    const track = createAimTrack({
      onDeleteKeyframe: () => undefined,
      project,
      trajectory: createTrajectory([]),
    });

    expect(track.summary).toBe("Follow path");
    expect(track.height).toBe(28);
    expect(track.lineY).toBe(14);
    expect(track.keyframes).toEqual([]);
  });

  it("shows the persisted start keyframe and its target", () => {
    const track = createAimTrack({
      onDeleteKeyframe: () => undefined,
      project,
      trajectory: createTrajectory([{
        id: "aim",
        path_position: 0,
        aim: {
          kind: "look_at_point",
          scene_point_id: "target",
          position: [0, 1, 0],
        },
        interpolation_to_next: "smoothstep",
      }]),
    });

    expect(track.summary).toBe("1 key");
    expect(track.keyframes).toEqual([{
      ariaLabel: "Look at Subject at 0%",
      id: "aim",
      pathPosition: 0,
      tooltip: "Look at Subject",
    }]);
  });
});
