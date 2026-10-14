"use client";
import { StatusExtension } from "./ui/status-extension";
import type { Extension } from "@camera-path/extension-api";
import { manifest } from "./manifest";
import { SceneExtension } from "./scene/scene-extension";
import { OverlayExtension } from "./ui/overlay-extension";
export const extension = {
  manifest,
  contributions: [
    { id: "trajectory.status", Component: StatusExtension },
    { id: "trajectory.scene", Component: SceneExtension },
    { id: "trajectory.overlay", Component: OverlayExtension },
  ],
} as const satisfies Extension;
