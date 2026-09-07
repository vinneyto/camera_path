import { createStore, type StoreApi } from "zustand/vanilla";

export type EditorTool = "anchor" | "anchor-height";
export type CameraMode = "orbit" | "trajectory";

export interface EditorCameraState {
  cameraMode: CameraMode;
}

export interface EditorToolState {
  activeTool: EditorTool | null;
  hoveredAnchorId: string | null;
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
  hoverAnchor: (anchorId: string) => void;
  setActiveTool: (tool: EditorTool | null) => void;
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

export type EditorStoreApi = StoreApi<EditorStore>;

export function createEditorStore(): EditorStoreApi {
  return createStore<EditorStore>((set) => ({
    camera: { cameraMode: "orbit" },
    cameraActions: {
      setCameraMode: (cameraMode) => set(cameraMode === "trajectory"
        ? {
            camera: { cameraMode },
            tool: { activeTool: null, hoveredAnchorId: null },
          }
        : { camera: { cameraMode } }),
    },
    playback: {
      elapsed: 0,
      pathPosition: 0,
      playing: false,
    },
    playbackActions: {
      resetPlayback: () => set({
        playback: { elapsed: 0, pathPosition: 0, playing: false },
      }),
      setPlaybackFrame: (pathPosition, elapsed) => set((state) => ({
        playback: { ...state.playback, elapsed, pathPosition },
      })),
      setPlaying: (playing) => set((state) => ({
        playback: { ...state.playback, playing },
      })),
    },
    selection: { trajectorySelected: false },
    selectionActions: {
      closeTrajectory: () => set({ selection: { trajectorySelected: false } }),
      selectTrajectory: () => set({ selection: { trajectorySelected: true } }),
    },
    tool: {
      activeTool: null,
      hoveredAnchorId: null,
    },
    toolActions: {
      clearHoveredAnchor: (anchorId) => set((state) => (
        state.tool.hoveredAnchorId === anchorId
          ? { tool: { ...state.tool, hoveredAnchorId: null } }
          : state
      )),
      hoverAnchor: (hoveredAnchorId) => set((state) => ({
        tool: { ...state.tool, hoveredAnchorId },
      })),
      setActiveTool: (activeTool) => set((state) => ({
        tool: { ...state.tool, activeTool },
      })),
    },
  }));
}
