"use client";
import type { Extension } from "@camera-path/extension-api";
import { manifest } from "./manifest";
import { RuntimeExtension } from "./ui/runtime-extension";
import { ControlsExtension } from "./ui/controls-extension";
export const extension = {
  manifest,
  contributions: [
    { id: "playback.runtime", Component: RuntimeExtension },
    { id: "playback.controls", Component: ControlsExtension },
  ],
} as const satisfies Extension;
