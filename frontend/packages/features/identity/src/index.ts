"use client";
import type { FeatureSlots } from "@camera-path/slots";
import { ProfileControl } from "./ui/profile-control";

export const slots = {
  header: {
    controls: [ProfileControl],
  },
} as const satisfies FeatureSlots;
