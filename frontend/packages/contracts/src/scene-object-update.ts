import type { SceneObjectId } from "./scene-object-id";
export interface SceneObjectUpdate {
  id: SceneObjectId | null;
  /** Apply only if the current object still has this ID; used by pointer-out and cleanup. */
  ifCurrentId?: SceneObjectId;
}
