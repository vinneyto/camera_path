"use client";
import type { Extension } from "@camera-path/extension-api";
import { manifest } from "./manifest";
import { RendererSettings } from "./ui/renderer-settings";
export const extension = {
  manifest,
  contributions: [
    { id: "renderer-preferences.settings", Component: RendererSettings },
  ],
} as const satisfies Extension;
