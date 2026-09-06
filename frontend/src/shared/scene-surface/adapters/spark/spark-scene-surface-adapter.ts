import type { SceneSurfaceAdapter } from "../../model/scene-surface-types";
import { SparkSurface } from "./spark-surface";
import { SparkSurfaceProvider } from "./spark-surface-provider";

export const sparkSceneSurfaceAdapter: SceneSurfaceAdapter = {
  Provider: SparkSurfaceProvider,
  Surface: SparkSurface,
};
