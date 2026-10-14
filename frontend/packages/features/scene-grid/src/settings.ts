import type { SettingsContribution } from "@camera-path/contracts/settings-contribution";
import { GridSettings } from "./ui/grid-settings";
export const settingsContribution: SettingsContribution = {
  id: "scene-grid.settings",
  Component: GridSettings,
};
