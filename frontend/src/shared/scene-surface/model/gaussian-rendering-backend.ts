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

export interface GaussianHighlightVolumeOptions {
  bottomOffset: number;
  color: SceneSurfacePoint;
  height: number;
  position: SceneSurfacePoint;
  radius: number;
  strength: number;
}

export interface GaussianHighlightVolume {
  dispose(): void;
  update(options: GaussianHighlightVolumeOptions): void;
}

export interface GaussianCloudInstance {
  readonly bounds: SceneSurfaceBounds | null;
  readonly object: Object3D;
  dispose(): void;
  getHit(intersection: Intersection<Object3D>, ray: Ray): SceneSurfaceHit;
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
  ): GaussianHighlightVolume;
  dispose(): void;
}
