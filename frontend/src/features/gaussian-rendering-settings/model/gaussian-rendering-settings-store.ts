"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { GaussianDprMode } from "@/shared/scene-surface";

interface GaussianRenderingSettingsState {
  dprMode: GaussianDprMode;
  webGpuTileRenderer: boolean;
  setDprMode: (mode: GaussianDprMode) => void;
  setWebGpuTileRenderer: (enabled: boolean) => void;
}

export const useGaussianRenderingSettingsStore =
  create<GaussianRenderingSettingsState>()(
    persist(
      (set) => ({
        dprMode: "1x",
        webGpuTileRenderer: true,
        setDprMode: (dprMode) => set({ dprMode }),
        setWebGpuTileRenderer: (webGpuTileRenderer) =>
          set({ webGpuTileRenderer }),
      }),
      {
        name: "camera-path-gaussian-rendering-settings",
        partialize: (state) => ({
          webGpuTileRenderer: state.webGpuTileRenderer,
        }),
        skipHydration: true,
      },
    ),
  );
