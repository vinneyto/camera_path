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
export { SceneSurfaceProvider } from "./ui/scene-surface-provider";
export { SceneSurface } from "./ui/scene-surface";
export { useGaussianRenderingBackend } from "./ui/use-gaussian-rendering-backend";
