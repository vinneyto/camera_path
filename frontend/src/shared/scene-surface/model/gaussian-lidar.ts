import type { Camera, Object3D } from "three";

export interface GaussianLidarSettings {
  verticalFovDegrees: number;
  horizontalResolution: number;
  verticalResolution: number;
}

export interface GaussianLidarInstance {
  readonly object: Object3D;
  setPose(camera: Camera): void;
  dispose(): void;
}
