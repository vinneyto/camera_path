"use client";
import { StatusExtension } from "./ui/status-extension";
import { HintExtension } from "./ui/hint-extension";
import type { Extension } from "@camera-path/extension-api";
import { manifest } from "./manifest";
import { SceneExtension } from "./scene/scene-extension";
export const extension = {
  manifest,
  contributions: [
    { id: "anchors.status", Component: StatusExtension },
    { id: "anchors.hint", Component: HintExtension },
    { id: "anchors.scene", Component: SceneExtension },
  ],
} as const satisfies Extension;
