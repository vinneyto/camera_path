"use client";

import type { SceneSurfaceProps } from "../model/scene-surface-types";
import { useSceneSurfaceAdapter } from "./scene-surface-provider";

export function SceneSurface(props: SceneSurfaceProps) {
  const adapter = useSceneSurfaceAdapter();
  const Surface = adapter.Surface;
  return <Surface {...props} />;
}
