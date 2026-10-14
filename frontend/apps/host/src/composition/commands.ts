import { ContributionRegistry } from "@camera-path/extension-api/contribution-registry";
import {
  ProjectCloudControls,
  manifest,
} from "@camera-path/feature-scene-models";
import type { ComponentType } from "react";
const registry = new ContributionRegistry<{
  id: string;
  Component: ComponentType<{ projectId: string }>;
}>();
registry.register(manifest, "scene-models.commands", {
  id: "scene-models.commands",
  Component: ProjectCloudControls,
});
export const commandContributions = registry.list("workspace.commands");
