import type { SceneObjectId } from "./scene-object-id";
export function anchorObjectId(anchorId: string): SceneObjectId {
  return `anchor:${anchorId}`;
}
