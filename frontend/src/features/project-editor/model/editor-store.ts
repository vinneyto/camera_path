"use client";

import { create } from "zustand";

export type EditorTool = "anchor" | "anchor-height";

interface EditorState {
  activeTool: EditorTool | null;
  elapsed: number;
  pathPosition: number;
  playing: boolean;
  trajectorySelected: boolean;
  closeTrajectory: () => void;
  resetEditor: () => void;
  resetPlayback: () => void;
  selectTrajectory: () => void;
  setActiveTool: (tool: EditorTool | null) => void;
  setPlaybackFrame: (pathPosition: number, elapsed: number) => void;
  setPlaying: (playing: boolean) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  activeTool: null,
  elapsed: 0,
  pathPosition: 0,
  playing: false,
  trajectorySelected: false,
  closeTrajectory: () => set({ trajectorySelected: false }),
  resetEditor: () => set({
    activeTool: null,
    elapsed: 0,
    pathPosition: 0,
    playing: false,
    trajectorySelected: false,
  }),
  resetPlayback: () => set({ elapsed: 0, pathPosition: 0, playing: false }),
  selectTrajectory: () => set({ trajectorySelected: true }),
  setActiveTool: (activeTool) => set({ activeTool }),
  setPlaybackFrame: (pathPosition, elapsed) => set({ elapsed, pathPosition }),
  setPlaying: (playing) => set({ playing }),
}));
