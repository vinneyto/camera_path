import type { StorageInstancedBufferAttribute, Texture } from "three/webgpu";
export interface LidarRangesGpuView {
  /** Integer texel (0,0) is the highest-elevation, first-azimuth bin. */
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
