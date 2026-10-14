"use client";
import type { Extension } from "@camera-path/extension-api";
import { manifest } from "./manifest";
import { ContentExtension } from "./ui/content-extension";
import { DetailsExtension } from "./ui/details-extension";
export const extension = {
  manifest,
  contributions: [
    { id: "library.content", Component: ContentExtension },
    { id: "library.details", Component: DetailsExtension },
  ],
} as const satisfies Extension;
