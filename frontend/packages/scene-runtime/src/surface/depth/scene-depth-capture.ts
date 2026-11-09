import type { Matrix4, Scene } from "three";

/** Six square float32 view-Z images in +X,-X,+Y,-Y,+Z,-Z order.
 * Top-left origin; zero means a miss. Captures include visible Gaussians
 * (source alpha > 0.1, opaque 2-sigma footprint) and opaque depth-writing meshes.
 * Helpers, transparent surfaces, grid, overlays and the sensor itself are excluded.
 */
export interface SceneDepthCube {
  readonly faces: readonly Float32Array[];
  readonly size: number;
}
export interface SceneDepthCapture {
  capture(
    scene: Scene,
    sensorWorldMatrix: Matrix4,
  ): Promise<SceneDepthCube | null>;
  dispose(): void;
}
