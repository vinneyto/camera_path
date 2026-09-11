import { describe, expect, it } from "vitest";

import type { CompiledTrajectory } from "@/entities/trajectory";

import { createOrientationTrack } from "./create-orientation-track";

describe("createOrientationTrack", () => {
  it("creates one compact event lane with all three angles in each tooltip", () => {
    const trajectory = {
      camera_track: {
        orientation_keyframes: [
          {
            id: "orientation-key",
            path_position: 0.25,
            orientation: { yaw_deg: 12, pitch_deg: -3, roll_deg: 7.5 },
            interpolation_to_next: "smoothstep",
          },
        ],
      },
    } as CompiledTrajectory;

    const track = createOrientationTrack({
      onDeleteKeyframe: () => undefined,
      trajectory,
    });

    expect(track.id).toBe("camera-orientation");
    expect(track.height).toBe(24);
    expect(track.keyframes).toHaveLength(1);
    expect(track.keyframes[0].tooltip).toBe(
      "Yaw 12.0° · Pitch -3.0° · Roll 7.5° · smoothstep",
    );
  });
});
