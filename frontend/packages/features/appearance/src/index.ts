"use client";
import type { FeatureSlots } from "@camera-path/slots";
import { ThemeToggle } from "./ui/theme-toggle";

export const slots = {
  header: {
    controls: [ThemeToggle],
  },
} as const satisfies FeatureSlots;
