"use client";
import { useUserSettings } from "@host/adapters/settings";

export function useSceneGrid() {
  const settings = useUserSettings();
  return {
    showGrid: settings.showGrid,
    toggleGrid: () => settings.save({ show_grid: !settings.showGrid }),
    loading: settings.loading,
    saving: settings.saving,
    ready: settings.ready,
    error: settings.error,
  };
}
