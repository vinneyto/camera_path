import { describe, expect, it } from "vitest";

import type { CompiledTrajectory } from "../model/types";
import { evaluateDepthOfFieldKeyframe } from "./evaluate-depth-of-field-keyframe";

const trajectory = {
  camera_track: {
    depth_of_field_keyframes: [],
  },
} as unknown as CompiledTrajectory;

describe("evaluateDepthOfFieldKeyframe", () => {
  it("disables depth of field when its timeline has no keys", () => {
    expect(evaluateDepthOfFieldKeyframe(trajectory, 0.5)).toBeNull();
  });

  it("uses one key and its parameters across the whole trajectory", () => {
    const withOneKey = structuredClone(trajectory);
    withOneKey.camera_track.depth_of_field_keyframes = [
      {
        id: "autofocus",
        path_position: 0.6,
        focus: { kind: "center_weighted_9" },
        focus_range_scale: 0.1,
        bokeh_scale: 10,
      },
    ];

    expect(evaluateDepthOfFieldKeyframe(withOneKey, 0)).toEqual(
      withOneKey.camera_track.depth_of_field_keyframes[0],
    );
    expect(evaluateDepthOfFieldKeyframe(withOneKey, 1)).toEqual(
      withOneKey.camera_track.depth_of_field_keyframes[0],
    );
  });

  it("switches to the latest key and parameters at its path position", () => {
    const withKeys = structuredClone(trajectory);
    withKeys.camera_track.depth_of_field_keyframes = [
      {
        id: "autofocus",
        path_position: 0.2,
        focus: { kind: "center_weighted_9" },
        focus_range_scale: 0.25,
        bokeh_scale: 6,
      },
      {
        id: "subject",
        path_position: 0.7,
        focus: {
          kind: "scene_point",
          scene_point_id: "subject",
          position: [1, 2, 3],
        },
        focus_range_scale: 0.08,
        bokeh_scale: 12,
      },
    ];

    expect(evaluateDepthOfFieldKeyframe(withKeys, 0.69)?.id).toBe("autofocus");
    expect(evaluateDepthOfFieldKeyframe(withKeys, 0.7)).toEqual(
      withKeys.camera_track.depth_of_field_keyframes[1],
    );
  });
});
