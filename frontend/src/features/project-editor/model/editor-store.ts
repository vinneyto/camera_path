"use client";

import { create } from "zustand";

export type AnchorPlacementMode = "inactive" | "held" | "pinned";
export type AnchorPlacementPhase = "surface" | "height";

interface EditorState {
  anchorPlacementMode: AnchorPlacementMode;
  anchorPlacementPhase: AnchorPlacementPhase;
  elapsed: number;
  pathPosition: number;
  playing: boolean;
  trajectorySelected: boolean;
  closeTrajectory: () => void;
  resetEditor: () => void;
  resetPlayback: () => void;
  selectTrajectory: () => void;
  setAnchorPlacementPhase: (phase: AnchorPlacementPhase) => void;
  setAnchorPlacementShiftHeld: (held: boolean) => void;
  setPlaybackFrame: (pathPosition: number, elapsed: number) => void;
  setPlaying: (playing: boolean) => void;
  toggleAnchorPlacementPinned: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  anchorPlacementMode: "inactive",
  anchorPlacementPhase: "surface",
  elapsed: 0,
  pathPosition: 0,
  playing: false,
  trajectorySelected: false,
  closeTrajectory: () => set({ trajectorySelected: false }),
  resetEditor: () => set({
    anchorPlacementMode: "inactive",
    anchorPlacementPhase: "surface",
    elapsed: 0,
    pathPosition: 0,
    playing: false,
    trajectorySelected: false,
  }),
  resetPlayback: () => set({ elapsed: 0, pathPosition: 0, playing: false }),
  selectTrajectory: () => set((state) => state.anchorPlacementMode === "inactive"
    ? { trajectorySelected: true }
    : state),
  setAnchorPlacementPhase: (anchorPlacementPhase) => set({ anchorPlacementPhase }),
  setAnchorPlacementShiftHeld: (held) => set((state) => {
    if (state.anchorPlacementMode === "pinned") return state;
    return {
      anchorPlacementMode: held ? "held" : "inactive",
      anchorPlacementPhase: "surface",
      trajectorySelected: held ? false : state.trajectorySelected,
    };
  }),
  setPlaybackFrame: (pathPosition, elapsed) => set({ elapsed, pathPosition }),
  setPlaying: (playing) => set({ playing }),
  toggleAnchorPlacementPinned: () => set((state) => ({
    anchorPlacementMode: state.anchorPlacementMode === "pinned" ? "inactive" : "pinned",
    anchorPlacementPhase: state.anchorPlacementMode === "held"
      ? state.anchorPlacementPhase
      : "surface",
    trajectorySelected: false,
  })),
}));
