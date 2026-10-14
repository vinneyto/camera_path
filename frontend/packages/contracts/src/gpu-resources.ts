import type { Camera, Object3D } from "three";
import type { StorageInstancedBufferAttribute, Texture } from "three/webgpu";
export interface GaussianSceneGpuView {
  readonly available: boolean;
  readonly createSensor: (settings: {
    verticalFovDegrees: number;
    horizontalResolution: number;
    verticalResolution: number;
  }) => SensorGpuLease;
}
export interface LidarRangesGpuView {
  readonly texture: Texture;
  readonly width: number;
  readonly height: number;
  readonly units: "meters";
  readonly format: "r32float";
  readonly invalidValue: number;
}
export interface LidarHitsGpuView {
  readonly buffer: StorageInstancedBufferAttribute;
  readonly count: number;
  readonly stride: 4;
  readonly coordinates: "world";
}
export interface SensorGpuLease {
  readonly object: Object3D;
  readonly ranges?: LidarRangesGpuView;
  readonly hits?: LidarHitsGpuView;
  setPose(camera: Camera): void;
  dispose(): void;
}
export interface GpuResourceDefinition<
  Id extends string = string,
  T = unknown,
> {
  readonly kind: "gpu-resource";
  readonly id: Id;
  readonly resourceKind: "texture" | "buffer" | "node" | "bundle";
  readonly validate: (value: unknown) => T;
}
export const gaussianScene: GpuResourceDefinition<
  "host.gaussians.scene@1",
  GaussianSceneGpuView
> = {
  kind: "gpu-resource",
  id: "host.gaussians.scene@1",
  resourceKind: "bundle",
  validate(value) {
    if (
      !value ||
      typeof value !== "object" ||
      !("createSensor" in value) ||
      typeof value.createSensor !== "function" ||
      !("available" in value) ||
      typeof value.available !== "boolean"
    )
      throw new TypeError("Invalid Gaussian scene GPU view");
    return value as GaussianSceneGpuView;
  },
};
export const lidarRanges: GpuResourceDefinition<
  "lidar.ranges@1",
  LidarRangesGpuView
> = {
  kind: "gpu-resource",
  id: "lidar.ranges@1",
  resourceKind: "texture",
  validate(value) {
    const v = value as LidarRangesGpuView;
    if (
      !v?.texture?.isTexture ||
      v.units !== "meters" ||
      v.format !== "r32float" ||
      !Number.isInteger(v.width) ||
      v.width < 1 ||
      !Number.isInteger(v.height) ||
      v.height < 1
    )
      throw new TypeError("Invalid LiDAR ranges GPU view");
    return v;
  },
};
export const lidarHitInstances: GpuResourceDefinition<
  "lidar.hitInstances@1",
  LidarHitsGpuView
> = {
  kind: "gpu-resource",
  id: "lidar.hitInstances@1",
  resourceKind: "buffer",
  validate(value) {
    const v = value as LidarHitsGpuView;
    if (
      !v?.buffer?.isInstancedBufferAttribute ||
      v.buffer.itemSize !== 4 ||
      v.stride !== 4 ||
      v.count !== v.buffer.count ||
      v.coordinates !== "world"
    )
      throw new TypeError("Invalid LiDAR hit GPU view");
    return v;
  },
};
