"use client";
import type { Extension } from "@camera-path/extension-api";
import { manifest } from "./manifest";
import { SceneExtension } from "./scene/scene-extension";
import { TimelineExtension } from "./timeline/timeline-extension";
import { EffectExtension } from "./timeline/effect-extension";
export const extension = {
  manifest,
  contributions: [
    { id: "depth-of-field.scene", Component: SceneExtension },
    { id: "depth-of-field.track", Component: TimelineExtension },
    { id: "depth-of-field.effect", Component: EffectExtension },
  ],
} as const satisfies Extension;
