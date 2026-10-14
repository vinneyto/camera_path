import { defineDataContract } from "../define-data-contract";
import { generatedSchema } from "../generated-schema";
import type { SceneObjectId } from "../scene-object-id";
export interface SceneInteractionState {
  readonly hoveredObjectId: SceneObjectId | null;
  readonly selectedObjectId: SceneObjectId | null;
}
export const sceneInteraction = defineDataContract(
  "host.scene.interaction@1",
  "The single hovered and selected scene object IDs in the current project.",
  generatedSchema("sceneInteraction"),
);
