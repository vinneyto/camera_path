export type FrustumPoint = [number, number, number];

interface PlaybackCameraFrustumOptions {
  aspect: number;
  far: number;
  fovDegrees: number;
  near: number;
}

export type PlaybackCameraHelperColor =
  typeof PLAYBACK_CAMERA_HELPER_COLORS[keyof typeof PLAYBACK_CAMERA_HELPER_COLORS];

export interface PlaybackCameraHelperSegment {
  color: PlaybackCameraHelperColor;
  end: FrustumPoint;
  start: FrustumPoint;
}

export interface PlaybackCameraHelperJoint {
  color: PlaybackCameraHelperColor;
  position: FrustumPoint;
}

interface PlaybackCameraFrustum {
  corners: FrustumPoint[];
  groups: PlaybackCameraHelperGroup[];
  joints: PlaybackCameraHelperJoint[];
  segments: PlaybackCameraHelperSegment[];
}

export interface PlaybackCameraHelperGroup {
  color: PlaybackCameraHelperColor;
  joints: PlaybackCameraHelperJoint[];
  segments: PlaybackCameraHelperSegment[];
}

export const PLAYBACK_CAMERA_HELPER_COLORS = {
  cone: "#ff0000",
  cross: "#333333",
  frustum: "#ffaa00",
  target: "#ffffff",
  up: "#00aaff",
} as const;

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

  const origin: FrustumPoint = [0, 0, 0];
  const nearCenter: FrustumPoint = [0, 0, -near];
  const farCenter: FrustumPoint = [0, 0, -far];
  const corners: FrustumPoint[] = [
    [-nearHalfWidth, nearHalfHeight, -near],
    [nearHalfWidth, nearHalfHeight, -near],
    [nearHalfWidth, -nearHalfHeight, -near],
    [-nearHalfWidth, -nearHalfHeight, -near],
    [-farHalfWidth, farHalfHeight, -far],
    [farHalfWidth, farHalfHeight, -far],
    [farHalfWidth, -farHalfHeight, -far],
    [-farHalfWidth, -farHalfHeight, -far],
  ];
  const upPoints: FrustumPoint[] = [
    [-nearHalfWidth * 0.7, nearHalfHeight * 1.1, -near],
    [nearHalfWidth * 0.7, nearHalfHeight * 1.1, -near],
    [0, nearHalfHeight * 2, -near],
  ];
  const nearCrossPoints: FrustumPoint[] = [
    [-nearHalfWidth, 0, -near],
    [nearHalfWidth, 0, -near],
    [0, -nearHalfHeight, -near],
    [0, nearHalfHeight, -near],
  ];
  const farCrossPoints: FrustumPoint[] = [
    [-farHalfWidth, 0, -far],
    [farHalfWidth, 0, -far],
    [0, -farHalfHeight, -far],
    [0, farHalfHeight, -far],
  ];
  const frustumSegmentIndices = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  const segments: PlaybackCameraHelperSegment[] = frustumSegmentIndices.map(
    ([start, end]) => ({
      color: PLAYBACK_CAMERA_HELPER_COLORS.frustum,
      end: corners[end],
      start: corners[start],
    }),
  );

  for (const corner of corners.slice(0, 4)) {
    segments.push({ color: PLAYBACK_CAMERA_HELPER_COLORS.cone, end: corner, start: origin });
  }
  segments.push(
    { color: PLAYBACK_CAMERA_HELPER_COLORS.up, end: upPoints[1], start: upPoints[0] },
    { color: PLAYBACK_CAMERA_HELPER_COLORS.up, end: upPoints[2], start: upPoints[1] },
    { color: PLAYBACK_CAMERA_HELPER_COLORS.up, end: upPoints[0], start: upPoints[2] },
    { color: PLAYBACK_CAMERA_HELPER_COLORS.target, end: farCenter, start: nearCenter },
    { color: PLAYBACK_CAMERA_HELPER_COLORS.cross, end: nearCenter, start: origin },
    {
      color: PLAYBACK_CAMERA_HELPER_COLORS.cross,
      end: nearCrossPoints[1],
      start: nearCrossPoints[0],
    },
    {
      color: PLAYBACK_CAMERA_HELPER_COLORS.cross,
      end: nearCrossPoints[3],
      start: nearCrossPoints[2],
    },
    {
      color: PLAYBACK_CAMERA_HELPER_COLORS.cross,
      end: farCrossPoints[1],
      start: farCrossPoints[0],
    },
    {
      color: PLAYBACK_CAMERA_HELPER_COLORS.cross,
      end: farCrossPoints[3],
      start: farCrossPoints[2],
    },
  );

  const joints: PlaybackCameraHelperJoint[] = [
    ...corners.map((position) => ({
      color: PLAYBACK_CAMERA_HELPER_COLORS.frustum,
      position,
    })),
    { color: PLAYBACK_CAMERA_HELPER_COLORS.cone, position: origin },
    ...upPoints.map((position) => ({ color: PLAYBACK_CAMERA_HELPER_COLORS.up, position })),
    { color: PLAYBACK_CAMERA_HELPER_COLORS.target, position: nearCenter },
    { color: PLAYBACK_CAMERA_HELPER_COLORS.target, position: farCenter },
    ...nearCrossPoints.map((position) => ({
      color: PLAYBACK_CAMERA_HELPER_COLORS.cross,
      position,
    })),
    ...farCrossPoints.map((position) => ({
      color: PLAYBACK_CAMERA_HELPER_COLORS.cross,
      position,
    })),
  ];

  return {
    corners,
    groups: Object.values(PLAYBACK_CAMERA_HELPER_COLORS).map((color) => ({
      color,
      joints: joints.filter((joint) => joint.color === color),
      segments: segments.filter((segment) => segment.color === color),
    })),
    joints,
    segments,
  };
}

export const PLAYBACK_CAMERA_FRUSTUM =
  createPlaybackCameraFrustum(PLAYBACK_CAMERA_FRUSTUM_OPTIONS);
