"use client";
import type { Extension } from "@camera-path/extension-api";
import { manifest } from "./manifest";
import { TimelineExtension } from "./timeline/timeline-extension";
export const extension = {
  manifest,
  contributions: [
    { id: "camera-orientation.track", Component: TimelineExtension },
  ],
} as const satisfies Extension;
