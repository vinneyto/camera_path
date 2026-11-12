import type { Matrix4, Scene, Texture } from "three";

/** Six square float32 view-Z images in +X,-X,+Y,-Y,+Z,-Z order.
 * Top-left origin; zero means a miss. Captures include visible Gaussians
 * (source alpha > 0.1, opaque 2-sigma footprint) and opaque depth-writing meshes.
 * Helpers, transparent surfaces, grid, overlays and the sensor itself are excluded.
 */
export interface SceneDepthCube {
  readonly faces: readonly Float32Array[];
  readonly size: number;
}
/** Native GPU textures, same face orientations as SceneDepthCube. */
export interface SceneDepthGpuCube {
  readonly faces: readonly Texture[];
  readonly size: number;
  /** When set, every face carries a whole-face readiness flag in green. */
  readonly readyInGreen?: boolean;
  readonly origin: "bottom-left" | "top-left";
}
export interface SceneDepthCapture {
  /** Production capture: all depth samples remain on the GPU. */
  render(
    scene: Scene,
    sensorWorldMatrix: Matrix4,
  ): Promise<SceneDepthGpuCube | null>;
  /** Explicit diagnostic/export readback; never used by live visualization. */
  capture(
    scene: Scene,
    sensorWorldMatrix: Matrix4,
  ): Promise<SceneDepthCube | null>;
  dispose(): void;
}
