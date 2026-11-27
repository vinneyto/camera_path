import type { CloudLoadOptions, GaussianCloud } from "3dgs-tile-webgpu";
export interface TileDepthSource {
  readonly buffer: ArrayBuffer;
  readonly options: CloudLoadOptions;
}
export type TileDepthSources = ReadonlyMap<GaussianCloud, TileDepthSource>;
