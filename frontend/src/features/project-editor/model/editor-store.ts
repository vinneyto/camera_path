"use client";

import { create } from "zustand";

interface EditorState {
  elapsed: number;
  pathPosition: number;
  playing: boolean;
  trajectorySelected: boolean;
  closeTrajectory: () => void;
  resetEditor: () => void;
  resetPlayback: () => void;
  selectTrajectory: () => void;
  setPlaybackFrame: (pathPosition: number, elapsed: number) => void;
  setPlaying: (playing: boolean) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  elapsed: 0,
  pathPosition: 0,
  playing: false,
  trajectorySelected: false,
  closeTrajectory: () => set({ trajectorySelected: false }),
  resetEditor: () => set({ elapsed: 0, pathPosition: 0, playing: false, trajectorySelected: false }),
  resetPlayback: () => set({ elapsed: 0, pathPosition: 0, playing: false }),
  selectTrajectory: () => set({ trajectorySelected: true }),
  setPlaybackFrame: (pathPosition, elapsed) => set({ elapsed, pathPosition }),
  setPlaying: (playing) => set({ playing }),
}));
