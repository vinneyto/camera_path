import type { UserSettings } from "@/shared/api/generated/model";

const KEY = "camera-path-editor-settings";

export function readEditorSettings(fallback: UserSettings): UserSettings {
  try {
    const saved = JSON.parse(
      localStorage.getItem(KEY) ?? "null",
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
