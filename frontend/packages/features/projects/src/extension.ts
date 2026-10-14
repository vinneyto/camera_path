"use client";
import type { Extension } from "@camera-path/extension-api";
import { manifest } from "./manifest";
import { ContentExtension } from "./ui/content-extension";
export const extension = {
  manifest,
  contributions: [{ id: "projects.content", Component: ContentExtension }],
} as const satisfies Extension;
