import { describe, expect, it } from "vitest";

import { createPlaybackCameraFrustum } from "./create-playback-camera-frustum";

describe("createPlaybackCameraFrustum", () => {
  it("builds twelve edges facing the camera's negative z axis", () => {
    const frustum = createPlaybackCameraFrustum({
      aspect: 2,
      far: 2,
      fovDegrees: 90,
      near: 1,
    });
    const xCoordinates = frustum.corners.map(([x]) => x);
    const yCoordinates = frustum.corners.map(([, y]) => y);
    const zCoordinates = frustum.corners.map(([, , z]) => z);

    expect(frustum.corners).toHaveLength(8);
    expect(frustum.segments).toHaveLength(12);
    expect(Math.max(...xCoordinates)).toBeCloseTo(4);
    expect(Math.min(...xCoordinates)).toBeCloseTo(-4);
    expect(Math.max(...yCoordinates)).toBeCloseTo(2);
    expect(Math.min(...yCoordinates)).toBeCloseTo(-2);
    expect(new Set(zCoordinates)).toEqual(new Set([-1, -2]));
  });
});
