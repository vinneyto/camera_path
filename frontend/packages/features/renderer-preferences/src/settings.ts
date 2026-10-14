import type { SettingsContribution } from "@camera-path/contracts/settings-contribution";
import { RendererSettings } from "./ui/renderer-settings";
export const settingsContribution: SettingsContribution = {
  id: "renderer-preferences.settings",
  Component: RendererSettings,
};
