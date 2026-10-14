"use client";
import type { Extension } from "@camera-path/extension-api";
import { manifest } from "./manifest";
import { SceneExtension } from "./scene/scene-extension";
import { GridSettings } from "./ui/grid-settings";
export const extension = {
  manifest,
  contributions: [
    { id: "scene-grid.scene", Component: SceneExtension },
    { id: "scene-grid.settings", Component: GridSettings },
  ],
} as const satisfies Extension;
