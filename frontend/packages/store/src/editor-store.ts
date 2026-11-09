import type {
  CameraMode,
  PlaybackState,
  ToolState,
  SceneWidgetMode,
} from "@camera-path/types/editor-state";
import { createStore, type StoreApi } from "zustand/vanilla";
export interface EditorState {
  camera: { cameraMode: CameraMode };
  playback: PlaybackState;
  tool: ToolState;
  chatComposer: { message: string };
  sceneInteraction: {
    hoveredObjectId: string | null;
    selectedObjectId: string | null;
    widget: SceneWidgetMode;
  };
}
export type EditorStoreApi = StoreApi<EditorState>;
/** A fresh store per mounted project; no module-level singleton and no actions. */
export function createEditorStore(): EditorStoreApi {
  return createStore<EditorState>(() => ({
    camera: { cameraMode: "orbit" },
    playback: { elapsed: 0, pathPosition: 0, playing: false },
    tool: { activeTool: null, pendingCloud: null },
    chatComposer: { message: "" },
    sceneInteraction: {
      hoveredObjectId: null,
      selectedObjectId: null,
      widget: "position",
    },
  }));
}
