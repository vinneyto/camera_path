"use client";
import type { FeatureSlots } from "@camera-path/slots";
import { SceneModels } from "./scene/scene";
import { CloudPlacementHint } from "./ui/hint";
import { ProjectCloudCommands } from "./ui/project-cloud-commands";

export const slots = {
  project: {
    scene: [SceneModels],
    hints: [CloudPlacementHint],
    commands: [ProjectCloudCommands],
  },
} as const satisfies FeatureSlots;
