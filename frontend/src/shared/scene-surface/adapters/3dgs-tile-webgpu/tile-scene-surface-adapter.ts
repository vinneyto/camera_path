import type { SceneSurfaceAdapter } from "../../model/scene-surface-types";
import { TileSurface } from "./tile-surface";
import { TileSurfaceProvider } from "./tile-surface-provider";

export const tileSceneSurfaceAdapter: SceneSurfaceAdapter = {
  Provider: TileSurfaceProvider,
  Surface: TileSurface,
};
