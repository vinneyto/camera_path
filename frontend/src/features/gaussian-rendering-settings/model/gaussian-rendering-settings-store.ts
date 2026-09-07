"use client";

import { create } from "zustand";

import type { GaussianDprMode } from "@/shared/scene-surface";

interface GaussianRenderingSettingsState {
  dprMode: GaussianDprMode;
  setDprMode: (mode: GaussianDprMode) => void;
}

export const useGaussianRenderingSettingsStore =
  create<GaussianRenderingSettingsState>((set) => ({
    dprMode: "1x",
    setDprMode: (dprMode) => set({ dprMode }),
  }));
