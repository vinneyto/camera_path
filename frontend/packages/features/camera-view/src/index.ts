"use client";
import type { FeatureSlots } from "@camera-path/slots";
import { CameraViewScene } from "./scene/scene";
import { CameraViewToolbar } from "./ui/toolbar";

export const slots = {
  project: {
    scene: [CameraViewScene],
    toolbar: [CameraViewToolbar],
  },
} as const satisfies FeatureSlots;
