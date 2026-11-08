import type { FeatureSlots } from "@camera-path/slots";
import { SceneModels } from "./scene/scene";
import { CloudPlacementHint } from "./ui/hint";
import { AddCloudCommand } from "./commands/add-cloud-command";
import { RemoveCloudCommand } from "./commands/remove-cloud-command";
import { TransformToolbar } from "./ui/transform-toolbar";

export const slots = {
  project: {
    scene: [SceneModels],
    hints: [CloudPlacementHint],
    toolbar: [TransformToolbar],
    commands: [AddCloudCommand, RemoveCloudCommand],
  },
} as const satisfies FeatureSlots;
