"use client";
import type { FeatureSlots } from "@camera-path/slots";
import { AnchorsScene } from "./scene/scene";
import { AnchorHint } from "./ui/hint";
import { AnchorStatus } from "./ui/status";

export const slots = {
  project: {
    scene: [AnchorsScene],
    hints: [AnchorHint],
    headerStatus: [AnchorStatus],
  },
} as const satisfies FeatureSlots;
