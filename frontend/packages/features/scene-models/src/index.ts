"use client";
import type { FeatureSlots } from "@camera-path/slots";
import { SceneModels } from "./scene/scene";
import { CloudPlacementHint } from "./ui/hint";
import { ProjectCloudControls } from "./ui/project-cloud-controls";

export const slots = {
  project: {
    scene: [SceneModels],
    hints: [CloudPlacementHint],
    commands: [ProjectCloudControls],
  },
} as const satisfies FeatureSlots;
