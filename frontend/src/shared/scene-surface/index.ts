export {
  type GaussianCloudSource,
  type SceneSurfaceBackground,
  type SceneSurfaceBounds,
  type SceneSurfaceHit,
  type SceneSurfacePoint,
  type SceneSurfacePointerHandler,
  type SceneSurfaceProps,
  type SceneSurfaceReady,
} from "./model/scene-surface-types";
export type {
  GaussianCloudInstance,
  GaussianCloudOptions,
  GaussianHighlightVolume,
  GaussianHighlightVolumeOptions,
  GaussianRenderingBackend,
} from "./model/gaussian-rendering-backend";
export { SceneSurfaceProvider } from "./ui/scene-surface-provider";
export { SceneSurface } from "./ui/scene-surface";
export { useGaussianRenderingBackend } from "./ui/use-gaussian-rendering-backend";
export { useGaussianHighlightVolume } from "./ui/use-gaussian-highlight-volume";
