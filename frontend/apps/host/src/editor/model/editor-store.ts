import type { LibraryAsset } from "@camera-path/contracts/api";
import { CameraController } from "@camera-path/feature-camera-view";
import { PlaybackController } from "@camera-path/feature-playback";
import { TrajectorySelectionController } from "@camera-path/feature-trajectory";
import { createStore, type StoreApi } from "zustand/vanilla";

export type EditorTool = "anchor" | "anchor-height" | "cloud";
export type CameraMode = "orbit" | "trajectory";
export type EditorHoveredObject =
  { id: string; type: "anchor" } | { type: "trajectory" };

export interface EditorCameraState {
  cameraMode: CameraMode;
}

export interface EditorToolState {
  activeTool: EditorTool | null;
  hoveredObject: EditorHoveredObject | null;
  pendingCloud: LibraryAsset | null;
}

export interface TrajectorySelectionState {
  trajectorySelected: boolean;
}

export interface EditorPlaybackState {
  elapsed: number;
  pathPosition: number;
  playing: boolean;
}

interface EditorCameraActions {
  setCameraMode: (mode: CameraMode) => void;
}

interface EditorToolActions {
  clearHoveredAnchor: (anchorId: string) => void;
  clearHoveredTrajectory: () => void;
  hoverAnchor: (anchorId: string) => void;
  hoverTrajectory: () => void;
  setActiveTool: (tool: EditorTool | null) => void;
  startCloudPlacement: (asset: LibraryAsset) => void;
}

interface TrajectorySelectionActions {
  closeTrajectory: () => void;
  selectTrajectory: () => void;
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
  selection: TrajectorySelectionState;
  selectionActions: TrajectorySelectionActions;
  tool: EditorToolState;
  toolActions: EditorToolActions;
}

export type EditorStoreApi = StoreApi<EditorStore> & {
  readonly controllers: {
    readonly camera: CameraController;
    readonly playback: PlaybackController;
    readonly selection: TrajectorySelectionController;
  };
};

// The host projection preserves the platform hooks while each feature owns its state.
// Only the host coordinates camera/tool and cloud-placement workflows.
export function createEditorStore(): EditorStoreApi {
  const camera = new CameraController();
  const playback = new PlaybackController();
  const selection = new TrajectorySelectionController();
  const store = createStore<EditorStore>((set) => ({
    camera: camera.read(),
    playback: playback.read(),
    selection: selection.read(),
    cameraActions: {
      setCameraMode: (mode) => {
        camera.setCameraMode(mode);
        if (mode === "trajectory")
          set({
            tool: { activeTool: null, hoveredObject: null, pendingCloud: null },
          });
      },
    },
    playbackActions: {
      resetPlayback: () => playback.resetPlayback(),
      setPlaybackFrame: (position, elapsed) =>
        playback.setPlaybackFrame(position, elapsed),
      setPlaying: (playing) => playback.setPlaying(playing),
    },
    selectionActions: {
      closeTrajectory: () => selection.closeTrajectory(),
      selectTrajectory: () => selection.selectTrajectory(),
    },
    tool: { activeTool: null, hoveredObject: null, pendingCloud: null },
    toolActions: {
      clearHoveredAnchor: (id) =>
        set((state) =>
          state.tool.hoveredObject?.type === "anchor" &&
          state.tool.hoveredObject.id === id
            ? { tool: { ...state.tool, hoveredObject: null } }
            : state,
        ),
      clearHoveredTrajectory: () =>
        set((state) =>
          state.tool.hoveredObject?.type === "trajectory"
            ? { tool: { ...state.tool, hoveredObject: null } }
            : state,
        ),
      hoverAnchor: (id) =>
        set((state) => ({
          tool: { ...state.tool, hoveredObject: { type: "anchor", id } },
        })),
      hoverTrajectory: () =>
        set((state) => ({
          tool: { ...state.tool, hoveredObject: { type: "trajectory" } },
        })),
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
        }));
      },
    },
  }));
  camera.subscribe(() => store.setState({ camera: camera.read() }));
  playback.subscribe(() => store.setState({ playback: playback.read() }));
  selection.subscribe(() => store.setState({ selection: selection.read() }));
  return Object.assign(store, { controllers: { camera, playback, selection } });
}
