import type {
  LidarHitsGpuView,
  LidarRangesGpuView,
} from "@camera-path/types/gpu-views";
import type { Camera, Object3D } from "three";

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
  dispose(): void;
}
