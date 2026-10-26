import type { UserSettings } from "@camera-path/types/api";

import { EDITOR_SETTINGS_KEY } from "./editor-settings-key";

export function readEditorSettings(fallback: UserSettings): UserSettings {
  try {
    const saved = JSON.parse(
      localStorage.getItem(EDITOR_SETTINGS_KEY) ?? "null",
    ) as Partial<UserSettings> | null;
    if (!saved || typeof saved !== "object") return fallback;
    return {
      webgpu_tile_renderer:
        typeof saved.webgpu_tile_renderer === "boolean"
          ? saved.webgpu_tile_renderer
          : fallback.webgpu_tile_renderer,
      show_grid:
        typeof saved.show_grid === "boolean"
          ? saved.show_grid
          : fallback.show_grid,
      gaussian_dpr:
        saved.gaussian_dpr === "system" || saved.gaussian_dpr === "1x"
          ? saved.gaussian_dpr
          : fallback.gaussian_dpr,
    };
  } catch {
    return fallback;
  }
}
