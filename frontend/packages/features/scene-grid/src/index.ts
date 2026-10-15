"use client";
import type { FeatureSlots } from "@camera-path/slots";
import { SceneGrid } from "./scene/scene";
import { GridSettings } from "./ui/grid-settings";

export const slots = {
  settings: {
    content: [GridSettings],
  },
  project: {
    scene: [SceneGrid],
  },
} as const satisfies FeatureSlots;
