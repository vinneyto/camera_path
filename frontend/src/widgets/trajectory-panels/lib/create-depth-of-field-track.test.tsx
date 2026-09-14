import { describe, expect, it } from "vitest";

import type { Project } from "@/entities/project";
import type { CompiledTrajectory } from "@/entities/trajectory";

import { createDepthOfFieldTrack } from "./create-depth-of-field-track";

describe("createDepthOfFieldTrack", () => {
  it("labels autofocus and concrete scene-point keys", () => {
    const project = {
      scene_points: {
        subject: { id: "subject", label: "Subject", position: [1, 2, 3] },
      },
    } as unknown as Project;
    const trajectory = {
      camera_track: {
        depth_of_field_keyframes: [
          {
            id: "auto",
            path_position: 0,
            focus: { kind: "center_weighted_9" },
          },
          {
            id: "point",
            path_position: 0.5,
            focus: {
              kind: "scene_point",
              scene_point_id: "subject",
              position: [1, 2, 3],
            },
          },
        ],
      },
    } as unknown as CompiledTrajectory;

    const track = createDepthOfFieldTrack({
      onDeleteKeyframe: () => undefined,
      project,
      trajectory,
    });

    expect(track.keyframes.map((key) => key.tooltip)).toEqual([
      "Nine-point autofocus",
      "Focus on Subject",
    ]);
  });
});
