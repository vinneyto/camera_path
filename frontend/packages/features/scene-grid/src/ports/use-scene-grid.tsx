"use client";
import { useUserSettings } from "@camera-path/api/settings";

export function useSceneGrid() {
  const s = useUserSettings();
  const save = useUserSettings().save;
  return {
    showGrid: s.showGrid,
    toggleGrid: () => void save({ show_grid: !s.showGrid }),
  };
}
