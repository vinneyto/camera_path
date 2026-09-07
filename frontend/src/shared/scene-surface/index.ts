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
export type { GaussianDprMode } from "./model/gaussian-dpr-mode";
export type {
  GaussianCloudInstance,
  GaussianCloudOptions,
  GaussianColorHighlightVolumeOptions,
  GaussianHighlightVolumeInstance,
  GaussianHighlightVolumeOptions,
  GaussianRippleHighlightVolumeOptions,
  GaussianRenderingBackend,
} from "./model/gaussian-rendering-backend";
export { SceneSurfaceProvider } from "./ui/scene-surface-provider";
export { SceneSurface } from "./ui/scene-surface";
export { useGaussianRenderingBackend } from "./ui/use-gaussian-rendering-backend";
export { GaussianHighlightVolume } from "./ui/gaussian-highlight-volume";
