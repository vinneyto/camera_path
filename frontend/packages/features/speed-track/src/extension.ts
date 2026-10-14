"use client";
import type { Extension } from "@camera-path/extension-api";
import { manifest } from "./manifest";
import { TimelineExtension } from "./timeline/timeline-extension";
export const extension = {
  manifest,
  contributions: [{ id: "speed-track.track", Component: TimelineExtension }],
} as const satisfies Extension;
