import type { SettingsContribution } from "@camera-path/contracts/settings-contribution";
import { ContributionRegistry } from "@camera-path/extension-api/contribution-registry";
import * as rendererPreferences from "@camera-path/feature-renderer-preferences";
import * as grid from "@camera-path/feature-scene-grid";
const registry = new ContributionRegistry<SettingsContribution>();
registry.register(
  rendererPreferences.manifest,
  rendererPreferences.settingsContribution.id,
  rendererPreferences.settingsContribution,
);
registry.register(
  grid.manifest,
  grid.settingsContribution.id,
  grid.settingsContribution,
);
export const settingsContributions = registry.list("settings.content");
