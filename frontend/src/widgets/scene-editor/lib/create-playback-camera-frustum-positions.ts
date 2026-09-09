interface PlaybackCameraFrustumOptions {
  aspect: number;
  far: number;
  fovDegrees: number;
  near: number;
}

export const PLAYBACK_CAMERA_FRUSTUM_OPTIONS: PlaybackCameraFrustumOptions = {
  aspect: 1.4,
  far: 0.7,
  fovDegrees: 50,
  near: 0.12,
};

export function createPlaybackCameraFrustumPositions({
  aspect,
  far,
  fovDegrees,
  near,
}: PlaybackCameraFrustumOptions) {
  const halfFovRadians = fovDegrees * Math.PI / 360;
  const nearHalfHeight = Math.tan(halfFovRadians) * near;
  const nearHalfWidth = nearHalfHeight * aspect;
  const farHalfHeight = Math.tan(halfFovRadians) * far;
  const farHalfWidth = farHalfHeight * aspect;

  const corners: [number, number, number][] = [
    [-nearHalfWidth, nearHalfHeight, -near],
    [nearHalfWidth, nearHalfHeight, -near],
    [nearHalfWidth, -nearHalfHeight, -near],
    [-nearHalfWidth, -nearHalfHeight, -near],
    [-farHalfWidth, farHalfHeight, -far],
    [farHalfWidth, farHalfHeight, -far],
    [farHalfWidth, -farHalfHeight, -far],
    [-farHalfWidth, -farHalfHeight, -far],
  ];
  const triangleCornerIndices = [
    0, 2, 1, 0, 3, 2,
    4, 5, 6, 4, 6, 7,
    0, 1, 5, 0, 5, 4,
    1, 2, 6, 1, 6, 5,
    2, 3, 7, 2, 7, 6,
    3, 0, 4, 3, 4, 7,
  ];

  return new Float32Array(
    triangleCornerIndices.flatMap((cornerIndex) => corners[cornerIndex]),
  );
}

export const PLAYBACK_CAMERA_FRUSTUM_POSITIONS =
  createPlaybackCameraFrustumPositions(PLAYBACK_CAMERA_FRUSTUM_OPTIONS);
