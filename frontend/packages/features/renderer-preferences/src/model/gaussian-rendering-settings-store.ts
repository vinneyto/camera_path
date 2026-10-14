"use client";
import type { GaussianDprMode } from "@camera-path/scene-runtime/surface";
import { create } from "zustand";

interface GaussianRenderingSettingsState {
  dprMode: GaussianDprMode;
  setDprMode: (mode: GaussianDprMode) => void;
}

export const useGaussianRenderingSettingsStore =
  create<GaussianRenderingSettingsState>((set) => ({
    dprMode: "1x",
    setDprMode: (dprMode) => set({ dprMode }),
  }));
