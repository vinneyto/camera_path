"use client";
import type { FeatureSlots } from "@camera-path/slots";
import { SceneModels } from "./scene/scene";
import { CloudPlacementHint } from "./ui/hint";
import { AddCloudCommand } from "./commands/add-cloud-command";
import { RemoveCloudCommand } from "./commands/remove-cloud-command";

export const slots = {
  project: {
    scene: [SceneModels],
    hints: [CloudPlacementHint],
    commands: [AddCloudCommand, RemoveCloudCommand],
  },
} as const satisfies FeatureSlots;
