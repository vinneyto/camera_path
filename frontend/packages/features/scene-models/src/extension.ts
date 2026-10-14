"use client";
import { HintExtension } from "./ui/hint-extension";
import type { Extension } from "@camera-path/extension-api";
import { manifest } from "./manifest";
import { SceneExtension } from "./scene/scene-extension";
import { ProjectCloudControls } from "./ui/project-cloud-controls";
export const extension = {
  manifest,
  contributions: [
    { id: "scene-models.hint", Component: HintExtension },
    { id: "scene-models.scene", Component: SceneExtension },
    { id: "scene-models.commands", Component: ProjectCloudControls },
  ],
} as const satisfies Extension;
