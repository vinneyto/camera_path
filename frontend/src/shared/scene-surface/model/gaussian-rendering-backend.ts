import type { Intersection, Object3D, Ray } from "three";

import type {
  GaussianCloudSource,
  SceneSurfaceBounds,
  SceneSurfaceHit,
  SceneSurfacePoint,
} from "./scene-surface-types";

export interface GaussianCloudOptions {
  name?: string;
  raycastable?: boolean;
}

interface GaussianHighlightVolumeBaseOptions {
  position: SceneSurfacePoint;
  radius: number;
}

export interface GaussianColorHighlightVolumeOptions
  extends GaussianHighlightVolumeBaseOptions {
  bottomOffset: number;
  color: SceneSurfacePoint;
  height: number;
  strength: number;
  type: "color";
}

export interface GaussianRippleHighlightVolumeOptions
  extends GaussianHighlightVolumeBaseOptions {
  amplitude: number;
  speed: number;
  tintColor: SceneSurfacePoint;
  tintStrength: number;
  type: "ripple";
  verticalCoreRadius: number;
  verticalFalloffRadius: number;
  wavelength: number;
}

export type GaussianHighlightVolumeOptions =
  | GaussianColorHighlightVolumeOptions
  | GaussianRippleHighlightVolumeOptions;

export interface GaussianHighlightVolumeInstance {
  dispose(): void;
  update(options: GaussianHighlightVolumeOptions): void;
}

export interface GaussianCloudInstance {
  readonly bounds: SceneSurfaceBounds | null;
  readonly object: Object3D;
  dispose(): void;
  getHit(intersection: Intersection<Object3D>, ray: Ray): SceneSurfaceHit;
  setRaycastable(raycastable: boolean): void;
}

export interface GaussianRenderingBackend {
  /** Optional scene object that must contain every cloud object (Spark uses it). */
  readonly container: Object3D | null;
  createCloud(
    source: GaussianCloudSource,
    options?: GaussianCloudOptions,
  ): Promise<GaussianCloudInstance>;
  createHighlightVolume(
    options: GaussianHighlightVolumeOptions,
  ): GaussianHighlightVolumeInstance;
  invalidate(): void;
  dispose(): void;
}
