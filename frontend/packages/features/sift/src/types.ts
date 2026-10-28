export interface KeyPoint {
  x: number;
  y: number;
  size: number;
  octave: number;
  class_id: number;
  response: number;
}
export interface DetectionTimings {
  grayscale_ms: number;
  pyramid_setup_ms: number;
  extrema_setup_ms: number;
  gpu_submit_ms: number;
  gpu_readback_ms: number;
  localization_ms: number;
  cleanup_ms: number;
}
export interface DetectionReport {
  points: KeyPoint[];
  timings: DetectionTimings;
}
export interface DetectorParams {
  n_octave_layers: number;
  contrast_threshold: number;
  edge_threshold: number;
  sigma: number;
  enable_subpixel_localization: boolean;
  enable_edge_like_filtering: boolean;
}
export type SessionSource =
  | { kind: "camera"; deviceId: string }
  | { kind: "image" | "video"; file: File };
export interface VideoPlaybackState {
  currentTime: number;
  duration: number;
  paused: boolean;
  ended: boolean;
}
export interface FrameRequest {
  width: number;
  height: number;
  rgba: ArrayBuffer;
  params: DetectorParams;
}
export type WorkerResponse =
  | { kind: "ready" }
  | { kind: "error"; message: string }
  | {
      kind: "frame";
      points: KeyPoint[];
      elapsed: number;
      timings?: DetectionTimings;
      width: number;
      height: number;
    };
export interface SiftWasm {
  default: (options: { module_or_path: string }) => Promise<unknown>;
  Detector: {
    create: () => Promise<{
      detect_rgba: (
        width: number,
        height: number,
        rgba: Uint8Array,
        params: string,
      ) => Promise<string>;
    }>;
  };
}
