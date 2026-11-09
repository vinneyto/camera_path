export const DEPTH_COVARIANCE_EPSILON = 1e-6;
export const DEPTH_NEAR = 0.01;
export const DEPTH_FAR = 10000;
export const DEPTH_CLIP_XY = 1.4;
export const DEPTH_OPAQUE_TRANSMITTANCE_THRESHOLD = 0.02;
export const DEPTH_ALPHA_CUTOFF = 0.1;
export const DEPTH_SPLAT_SIGMA = 2;
export const LIDAR_ERROR_RETRY_MS = 1000;
export const LIDAR_CAPTURE_INTERVAL_MS = 100;
export const LIDAR_MIN_FACE_SIZE = 16;
export const LIDAR_MAX_FACE_SIZE = 512;
export const LIDAR_HIT_RADIUS = 0.01;
export const LIDAR_HIT_WIDTH_SEGMENTS = 16;
export const LIDAR_HIT_HEIGHT_SEGMENTS = 12;
export const LIDAR_HIT_RENDER_ORDER = 0;
export const LIDAR_HIT_COLOR = 0x35f2a1;
// Forward and up in sensor coordinates. Every image has a top-left origin.
export const DEPTH_CUBE_FACES = [
  { forward: [1, 0, 0], up: [0, -1, 0] },
  { forward: [-1, 0, 0], up: [0, -1, 0] },
  { forward: [0, 1, 0], up: [0, 0, 1] },
  { forward: [0, -1, 0], up: [0, 0, -1] },
  { forward: [0, 0, 1], up: [0, -1, 0] },
  { forward: [0, 0, -1], up: [0, -1, 0] },
] as const;
