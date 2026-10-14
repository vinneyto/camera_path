"use client";
import type { Extension } from "@camera-path/extension-api";
import { manifest } from "./manifest";
import { SceneExtension } from "./scene/scene-extension";
import { ToolbarExtension } from "./ui/toolbar-extension";
export const extension = {
  manifest,
  contributions: [
    { id: "camera-view.scene", Component: SceneExtension },
    { id: "camera-view.toolbar", Component: ToolbarExtension },
  ],
} as const satisfies Extension;
