export type CameraHelperPoint = [number, number, number];

interface PlaybackCameraHelperOptions {
  aspect: number;
  far: number;
  fovDegrees: number;
  near: number;
}

export interface PlaybackCameraHelperSegment {
  color: string;
  end: CameraHelperPoint;
  start: CameraHelperPoint;
}

export const PLAYBACK_CAMERA_HELPER_COLORS = {
  cone: "#f87171",
  cross: "#64748b",
  frustum: "#60a5fa",
  target: "#f8fafc",
  up: "#a78bfa",
} as const;

export const PLAYBACK_CAMERA_HELPER_OPTIONS: PlaybackCameraHelperOptions = {
  aspect: 1.4,
  far: 0.35,
  fovDegrees: 50,
  near: 0.06,
};

export function createPlaybackCameraHelperSegments({
  aspect,
  far,
  fovDegrees,
  near,
}: PlaybackCameraHelperOptions): PlaybackCameraHelperSegment[] {
  const halfFovRadians = fovDegrees * Math.PI / 360;
  const nearHalfHeight = Math.tan(halfFovRadians) * near;
  const nearHalfWidth = nearHalfHeight * aspect;
  const farHalfHeight = Math.tan(halfFovRadians) * far;
  const farHalfWidth = farHalfHeight * aspect;
  const origin: CameraHelperPoint = [0, 0, 0];
  const nearCenter: CameraHelperPoint = [0, 0, -near];
  const farCenter: CameraHelperPoint = [0, 0, -far];
  const nearCorners: CameraHelperPoint[] = [
    [-nearHalfWidth, nearHalfHeight, -near],
    [nearHalfWidth, nearHalfHeight, -near],
    [nearHalfWidth, -nearHalfHeight, -near],
    [-nearHalfWidth, -nearHalfHeight, -near],
  ];
  const farCorners: CameraHelperPoint[] = [
    [-farHalfWidth, farHalfHeight, -far],
    [farHalfWidth, farHalfHeight, -far],
    [farHalfWidth, -farHalfHeight, -far],
    [-farHalfWidth, -farHalfHeight, -far],
  ];
  const up: CameraHelperPoint[] = [
    [-nearHalfWidth * 0.7, nearHalfHeight * 1.1, -near],
    [nearHalfWidth * 0.7, nearHalfHeight * 1.1, -near],
    [0, nearHalfHeight * 2, -near],
  ];
  const nearCross: CameraHelperPoint[] = [
    [-nearHalfWidth, 0, -near],
    [nearHalfWidth, 0, -near],
    [0, -nearHalfHeight, -near],
    [0, nearHalfHeight, -near],
  ];
  const farCross: CameraHelperPoint[] = [
    [-farHalfWidth, 0, -far],
    [farHalfWidth, 0, -far],
    [0, -farHalfHeight, -far],
    [0, farHalfHeight, -far],
  ];
  const segments: PlaybackCameraHelperSegment[] = [];
  const add = (
    color: string,
    start: CameraHelperPoint,
    end: CameraHelperPoint,
  ) => segments.push({ color, end, start });

  for (const corners of [nearCorners, farCorners]) {
    add(PLAYBACK_CAMERA_HELPER_COLORS.frustum, corners[0], corners[1]);
    add(PLAYBACK_CAMERA_HELPER_COLORS.frustum, corners[1], corners[2]);
    add(PLAYBACK_CAMERA_HELPER_COLORS.frustum, corners[2], corners[3]);
    add(PLAYBACK_CAMERA_HELPER_COLORS.frustum, corners[3], corners[0]);
  }
  for (let index = 0; index < 4; index += 1) {
    add(PLAYBACK_CAMERA_HELPER_COLORS.frustum, nearCorners[index], farCorners[index]);
    add(PLAYBACK_CAMERA_HELPER_COLORS.cone, origin, nearCorners[index]);
  }
  add(PLAYBACK_CAMERA_HELPER_COLORS.up, up[0], up[1]);
  add(PLAYBACK_CAMERA_HELPER_COLORS.up, up[1], up[2]);
  add(PLAYBACK_CAMERA_HELPER_COLORS.up, up[2], up[0]);
  add(PLAYBACK_CAMERA_HELPER_COLORS.target, nearCenter, farCenter);
  add(PLAYBACK_CAMERA_HELPER_COLORS.cross, origin, nearCenter);
  add(PLAYBACK_CAMERA_HELPER_COLORS.cross, nearCross[0], nearCross[1]);
  add(PLAYBACK_CAMERA_HELPER_COLORS.cross, nearCross[2], nearCross[3]);
  add(PLAYBACK_CAMERA_HELPER_COLORS.cross, farCross[0], farCross[1]);
  add(PLAYBACK_CAMERA_HELPER_COLORS.cross, farCross[2], farCross[3]);

  return segments;
}

export const PLAYBACK_CAMERA_HELPER_SEGMENTS =
  createPlaybackCameraHelperSegments(PLAYBACK_CAMERA_HELPER_OPTIONS);
