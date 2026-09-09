import { describe, expect, it } from "vitest";

import {
  createPlaybackCameraFrustum,
  PLAYBACK_CAMERA_HELPER_COLORS,
} from "./create-playback-camera-frustum";

describe("createPlaybackCameraFrustum", () => {
  it("matches the original CameraHelper structure and colors", () => {
    const helper = createPlaybackCameraFrustum({
      aspect: 2,
      far: 2,
      fovDegrees: 90,
      near: 1,
    });
    const xCoordinates = helper.corners.map(([x]) => x);
    const yCoordinates = helper.corners.map(([, y]) => y);
    const zCoordinates = helper.corners.map(([, , z]) => z);
    const segmentCountByColor = Object.fromEntries(
      Object.values(PLAYBACK_CAMERA_HELPER_COLORS).map((color) => [
        color,
        helper.segments.filter((segment) => segment.color === color).length,
      ]),
    );

    expect(helper.corners).toHaveLength(8);
    expect(helper.segments).toHaveLength(25);
    expect(segmentCountByColor).toEqual({
      "#00aaff": 3,
      "#333333": 5,
      "#ff0000": 4,
      "#ffaa00": 12,
      "#ffffff": 1,
    });
    expect(Math.max(...xCoordinates)).toBeCloseTo(4);
    expect(Math.min(...xCoordinates)).toBeCloseTo(-4);
    expect(Math.max(...yCoordinates)).toBeCloseTo(2);
    expect(Math.min(...yCoordinates)).toBeCloseTo(-2);
    expect(new Set(zCoordinates)).toEqual(new Set([-1, -2]));

    const upSegments = helper.segments.filter(
      (segment) => segment.color === PLAYBACK_CAMERA_HELPER_COLORS.up,
    );
    expect(Math.max(...upSegments.flatMap(({ end, start }) => [end[1], start[1]]))).toBeCloseTo(2);
  });
});
