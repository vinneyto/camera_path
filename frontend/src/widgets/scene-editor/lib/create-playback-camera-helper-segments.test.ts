import { describe, expect, it } from "vitest";

import {
  createPlaybackCameraHelperSegments,
  PLAYBACK_CAMERA_HELPER_COLORS,
} from "./create-playback-camera-helper-segments";

describe("createPlaybackCameraHelperSegments", () => {
  it("matches the original CameraHelper segment groups", () => {
    const segments = createPlaybackCameraHelperSegments({
      aspect: 2,
      far: 2,
      fovDegrees: 90,
      near: 1,
    });

    expect(segments).toHaveLength(25);
    expect(
      Object.fromEntries(
        Object.values(PLAYBACK_CAMERA_HELPER_COLORS).map((color) => [
          color,
          segments.filter((segment) => segment.color === color).length,
        ]),
      ),
    ).toEqual({
      "#60a5fa": 12,
      "#64748b": 5,
      "#a78bfa": 3,
      "#f87171": 4,
      "#f8fafc": 1,
    });
    expect(
      segments.every(({ end, start }) => end[2] <= 0 && start[2] <= 0),
    ).toBe(true);
  });
});
