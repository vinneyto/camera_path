"use client";
import type { Extension } from "@camera-path/extension-api";
import { manifest } from "./manifest";
import { SceneExtension } from "./ui/scene-extension";
import { TimelineExtension } from "./timeline/timeline-extension";
import { EffectExtension } from "./timeline/effect-extension";
export const extension = {
  manifest,
  contributions: [
    { id: "lidar.scene", Component: SceneExtension },
    { id: "lidar.track", Component: TimelineExtension },
    { id: "lidar.effect", Component: EffectExtension },
  ],
} as const satisfies Extension;
