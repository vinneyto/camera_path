export type FrustumCorner = [number, number, number];

interface PlaybackCameraFrustumOptions {
  aspect: number;
  far: number;
  fovDegrees: number;
  near: number;
}

interface PlaybackCameraFrustum {
  corners: FrustumCorner[];
  segments: [FrustumCorner, FrustumCorner][];
}

export const PLAYBACK_CAMERA_FRUSTUM_OPTIONS: PlaybackCameraFrustumOptions = {
  aspect: 1.4,
  far: 0.7,
  fovDegrees: 50,
  near: 0.12,
};

export function createPlaybackCameraFrustum({
  aspect,
  far,
  fovDegrees,
  near,
}: PlaybackCameraFrustumOptions): PlaybackCameraFrustum {
  const halfFovRadians = fovDegrees * Math.PI / 360;
  const nearHalfHeight = Math.tan(halfFovRadians) * near;
  const nearHalfWidth = nearHalfHeight * aspect;
  const farHalfHeight = Math.tan(halfFovRadians) * far;
  const farHalfWidth = farHalfHeight * aspect;

  const corners: FrustumCorner[] = [
    [-nearHalfWidth, nearHalfHeight, -near],
    [nearHalfWidth, nearHalfHeight, -near],
    [nearHalfWidth, -nearHalfHeight, -near],
    [-nearHalfWidth, -nearHalfHeight, -near],
    [-farHalfWidth, farHalfHeight, -far],
    [farHalfWidth, farHalfHeight, -far],
    [farHalfWidth, -farHalfHeight, -far],
    [-farHalfWidth, -farHalfHeight, -far],
  ];
  const segmentCornerIndices = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];

  return {
    corners,
    segments: segmentCornerIndices.map(([start, end]) => [corners[start], corners[end]]),
  };
}

export const PLAYBACK_CAMERA_FRUSTUM =
  createPlaybackCameraFrustum(PLAYBACK_CAMERA_FRUSTUM_OPTIONS);
