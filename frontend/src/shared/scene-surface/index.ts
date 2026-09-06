export {
  type GaussianCloudSource,
  type SceneSurfaceBackground,
  type SceneSurfaceBounds,
  type SceneSurfaceHit,
  type SceneSurfacePoint,
  type SceneSurfaceProps,
  type SceneSurfaceReady,
} from "./model/scene-surface-types";
export type {
  GaussianCloudInstance,
  GaussianCloudOptions,
  GaussianRenderingBackend,
} from "./model/gaussian-rendering-backend";
export { SparkGaussianRenderingBackend } from "./adapters/spark/spark-gaussian-rendering-backend";
export { TileGaussianRenderingBackend } from "./adapters/3dgs-tile-webgpu/tile-gaussian-rendering-backend";
export { SceneSurfaceProvider } from "./ui/scene-surface-provider";
export { SceneSurface } from "./ui/scene-surface";
