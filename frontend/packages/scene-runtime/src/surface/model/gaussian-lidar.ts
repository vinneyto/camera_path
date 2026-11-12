import type {
  LidarHitsGpuView,
  LidarRangesGpuView,
} from "@camera-path/types/gpu-views";
import type { Camera, Object3D, Scene } from "three";

export interface GaussianLidarSettings {
  verticalFovDegrees: number;
  horizontalResolution: number;
  verticalResolution: number;
}

export interface GaussianLidarInstance {
  readonly object: Object3D;
  readonly ranges?: LidarRangesGpuView;
  readonly hits?: LidarHitsGpuView;
  setPose(camera: Camera): void;
  /** Capture scheduling is shared by every renderer, after the pose update. */
  update(scene: Scene): void;
  dispose(): void;
}
