import type { LidarRangesGpuView } from "@camera-path/types/gpu-views";
import type { Matrix4, Mesh } from "three";
import type { SceneDepthGpuCube } from "./scene-depth-capture";
export interface GpuLidarView {
  readonly object: Mesh;
  readonly ranges: LidarRangesGpuView;
  draw(cube: SceneDepthGpuCube, pose: Matrix4): Promise<void>;
  dispose(): void;
}
