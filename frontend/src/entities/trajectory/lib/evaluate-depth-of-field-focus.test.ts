import { describe, expect, it } from "vitest";

import type { CompiledTrajectory } from "../model/types";
import { evaluateDepthOfFieldFocus } from "./evaluate-depth-of-field-focus";

const trajectory = {
  camera_track: {
    depth_of_field_keyframes: [],
  },
} as unknown as CompiledTrajectory;

describe("evaluateDepthOfFieldFocus", () => {
  it("disables depth of field when its timeline has no keys", () => {
    expect(evaluateDepthOfFieldFocus(trajectory, 0.5)).toBeNull();
  });

  it("uses one key across the whole trajectory", () => {
    const withOneKey = structuredClone(trajectory);
    withOneKey.camera_track.depth_of_field_keyframes = [
      {
        id: "autofocus",
        path_position: 0.6,
        focus: { kind: "center_weighted_9" },
      },
    ];

    expect(evaluateDepthOfFieldFocus(withOneKey, 0)?.kind).toBe(
      "center_weighted_9",
    );
    expect(evaluateDepthOfFieldFocus(withOneKey, 1)?.kind).toBe(
      "center_weighted_9",
    );
  });

  it("switches to the latest focus key at its path position", () => {
    const withKeys = structuredClone(trajectory);
    withKeys.camera_track.depth_of_field_keyframes = [
      {
        id: "autofocus",
        path_position: 0.2,
        focus: { kind: "center_weighted_9" },
      },
      {
        id: "subject",
        path_position: 0.7,
        focus: {
          kind: "scene_point",
          scene_point_id: "subject",
          position: [1, 2, 3],
        },
      },
    ];

    expect(evaluateDepthOfFieldFocus(withKeys, 0.69)?.kind).toBe(
      "center_weighted_9",
    );
    expect(evaluateDepthOfFieldFocus(withKeys, 0.7)).toEqual({
      kind: "scene_point",
      scene_point_id: "subject",
      position: [1, 2, 3],
    });
  });
});
