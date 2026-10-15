"use client";
import type { FeatureSlots } from "@camera-path/slots";
import { ProjectsContent } from "./ui/content";

export const slots = {
  dashboard: {
    content: [ProjectsContent],
  },
} as const satisfies FeatureSlots;
