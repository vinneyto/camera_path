"use client";
import type { FeatureSlots } from "@camera-path/slots";
import { ProfileControl } from "./ui/profile-control";

export const slots = {
  profile: {
    account: [ProfileControl],
  },
} as const satisfies FeatureSlots;
