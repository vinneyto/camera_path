"use client";
import type { FeatureSlots } from "@camera-path/slots";
import { TrajectoryScene } from "./scene/scene";
import { TrajectoryStatus } from "./ui/status";

export const slots = {
  project: {
    scene: [TrajectoryScene],
    headerStatus: [TrajectoryStatus],
  },
} as const satisfies FeatureSlots;
