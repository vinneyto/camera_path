"use client";
import type { Extension } from "@camera-path/extension-api";
import { manifest } from "./manifest";
import { ThemeToggle } from "./ui/theme-toggle";
export const extension = {
  manifest,
  contributions: [{ id: "appearance.toggle", Component: ThemeToggle }],
} as const satisfies Extension;
