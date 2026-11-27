import type { SceneObject } from "./api";

export type SceneObjectTransform = Pick<
  SceneObject,
  "position" | "quaternion" | "scale"
>;
export interface SceneObjectTransformDraft {
  id: string;
  transform: SceneObjectTransform;
}
export interface SceneObjectTransformInteraction {
  preview: SceneObjectTransformDraft | null;
  pending: boolean;
  begin: (id: string, transform: SceneObjectTransform) => void;
  change: (id: string, transform: SceneObjectTransform) => void;
  commit: (id: string, transform: SceneObjectTransform) => void;
  cancel: (id: string) => void;
}
