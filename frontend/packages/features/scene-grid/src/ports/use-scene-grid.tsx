"use client";
import { preferencesState } from "@camera-path/contracts/host-data";
import { savePreferences } from "@camera-path/contracts/host-requests";
import { useData, useRequestAction } from "@camera-path/extension-api";
import { manifest } from "../manifest";
export function useSceneGrid() {
  const s = useData(manifest, preferencesState);
  const save = useRequestAction(manifest, savePreferences);
  return {
    showGrid: s.showGrid,
    toggleGrid: () => void save({ show_grid: !s.showGrid }),
  };
}
