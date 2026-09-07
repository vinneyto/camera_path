import { createStore, type StoreApi } from "zustand/vanilla";

export type EditorTool = "anchor" | "anchor-height";
export type CameraMode = "orbit" | "trajectory";
export type EditorHoveredObject =
  | { id: string; type: "anchor" }
  | { type: "trajectory" };

export interface EditorCameraState {
  cameraMode: CameraMode;
}

export interface EditorToolState {
  activeTool: EditorTool | null;
  hoveredObject: EditorHoveredObject | null;
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
            tool: { activeTool: null, hoveredObject: null },
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
      hoveredObject: null,
    },
    toolActions: {
      clearHoveredAnchor: (anchorId) => set((state) => (
        state.tool.hoveredObject?.type === "anchor"
          && state.tool.hoveredObject.id === anchorId
          ? { tool: { ...state.tool, hoveredObject: null } }
          : state
      )),
      clearHoveredTrajectory: () => set((state) => (
        state.tool.hoveredObject?.type === "trajectory"
          ? { tool: { ...state.tool, hoveredObject: null } }
          : state
      )),
      hoverAnchor: (id) => set((state) => ({
        tool: { ...state.tool, hoveredObject: { id, type: "anchor" } },
      })),
      hoverTrajectory: () => set((state) => ({
        tool: { ...state.tool, hoveredObject: { type: "trajectory" } },
      })),
      setActiveTool: (activeTool) => set((state) => ({
        tool: { ...state.tool, activeTool },
      })),
    },
  }));
}
