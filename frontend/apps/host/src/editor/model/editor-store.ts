import type { LibraryAsset } from "@camera-path/contracts/api";
import type { SceneInteractionState } from "@camera-path/contracts/host-data/scene-interaction";
import type {
  CameraMode,
  EditorTool,
  PlaybackState,
  ToolState,
} from "@camera-path/contracts/host-state";
import type { SceneObjectUpdate } from "@camera-path/contracts/scene-object-update";
import { CameraController } from "./cameraController";
import { PlaybackController } from "./playbackController";
import { createStore, type StoreApi } from "zustand/vanilla";

export type { CameraMode, EditorTool };
export interface EditorCameraState {
  cameraMode: CameraMode;
}
export type EditorToolState = ToolState;
export type EditorPlaybackState = PlaybackState;
interface EditorCameraActions {
  setCameraMode: (mode: CameraMode) => void;
}
interface EditorToolActions {
  setActiveTool: (tool: EditorTool | null) => void;
  startCloudPlacement: (asset: LibraryAsset) => void;
}
interface SceneInteractionActions {
  hoverObject: (input: SceneObjectUpdate) => void;
  selectObject: (input: SceneObjectUpdate) => void;
}
interface EditorPlaybackActions {
  resetPlayback: () => void;
  setPlaybackFrame: (pathPosition: number, elapsed: number) => void;
  setPlaying: (playing: boolean) => void;
}
export interface EditorStore {
  camera: EditorCameraState;
  cameraActions: EditorCameraActions;
  playback: EditorPlaybackState;
  playbackActions: EditorPlaybackActions;
  sceneInteraction: SceneInteractionState;
  sceneInteractionActions: SceneInteractionActions;
  tool: EditorToolState;
  toolActions: EditorToolActions;
}
export type EditorStoreApi = StoreApi<EditorStore> & {
  readonly controllers: {
    readonly camera: CameraController;
    readonly playback: PlaybackController;
  };
};

// The host owns scene interaction; hover and selection each hold a single object ID.
export function createEditorStore(): EditorStoreApi {
  const camera = new CameraController();
  const playback = new PlaybackController();
  const store = createStore<EditorStore>((set) => {
    const updateObject = (
      field: keyof SceneInteractionState,
      { id, ifCurrentId }: SceneObjectUpdate,
    ) =>
      set((state) => {
        const current = state.sceneInteraction[field];
        if (
          (ifCurrentId !== undefined && current !== ifCurrentId) ||
          current === id
        )
          return state;
        return { sceneInteraction: { ...state.sceneInteraction, [field]: id } };
      });
    return {
      camera: camera.read(),
      playback: playback.read(),
      sceneInteraction: { hoveredObjectId: null, selectedObjectId: null },
      sceneInteractionActions: {
        hoverObject: (input) => updateObject("hoveredObjectId", input),
        selectObject: (input) => updateObject("selectedObjectId", input),
      },
      cameraActions: {
        setCameraMode: (mode) => {
          camera.setCameraMode(mode);
          if (mode === "trajectory")
            set((state) => ({
              tool: { activeTool: null, pendingCloud: null },
              sceneInteraction: {
                ...state.sceneInteraction,
                hoveredObjectId: null,
              },
            }));
        },
      },
      playbackActions: {
        resetPlayback: () => playback.resetPlayback(),
        setPlaybackFrame: (position, elapsed) =>
          playback.setPlaybackFrame(position, elapsed),
        setPlaying: (playing) => playback.setPlaying(playing),
      },
      tool: { activeTool: null, pendingCloud: null },
      toolActions: {
        setActiveTool: (activeTool) =>
          set((state) => ({
            tool: {
              ...state.tool,
              activeTool,
              pendingCloud:
                activeTool === "cloud" ? state.tool.pendingCloud : null,
            },
          })),
        startCloudPlacement: (asset) => {
          camera.setCameraMode("orbit");
          set((state) => ({
            tool: {
              ...state.tool,
              activeTool: "cloud",
              pendingCloud: { ...asset },
            },
            sceneInteraction: {
              ...state.sceneInteraction,
              hoveredObjectId: null,
            },
          }));
        },
      },
    };
  });
  camera.subscribe(() => store.setState({ camera: camera.read() }));
  playback.subscribe(() => store.setState({ playback: playback.read() }));
  return Object.assign(store, { controllers: { camera, playback } });
}
