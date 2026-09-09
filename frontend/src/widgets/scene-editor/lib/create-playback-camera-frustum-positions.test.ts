import { describe, expect, it } from "vitest";

import { createPlaybackCameraFrustumPositions } from "./create-playback-camera-frustum-positions";

describe("createPlaybackCameraFrustumPositions", () => {
  it("builds a closed frustum facing the camera's negative z axis", () => {
    const positions = createPlaybackCameraFrustumPositions({
      aspect: 2,
      far: 2,
      fovDegrees: 90,
      near: 1,
    });
    const xCoordinates = positions.filter((_, index) => index % 3 === 0);
    const yCoordinates = positions.filter((_, index) => index % 3 === 1);
    const zCoordinates = positions.filter((_, index) => index % 3 === 2);

    expect(positions).toHaveLength(12 * 3 * 3);
    expect(Math.max(...xCoordinates)).toBeCloseTo(4);
    expect(Math.min(...xCoordinates)).toBeCloseTo(-4);
    expect(Math.max(...yCoordinates)).toBeCloseTo(2);
    expect(Math.min(...yCoordinates)).toBeCloseTo(-2);
    expect(new Set(zCoordinates)).toEqual(new Set([-1, -2]));
  });
});
