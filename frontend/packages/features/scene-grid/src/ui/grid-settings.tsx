"use client";
import { useUserSettingsActions } from "@camera-path/actions";
import { useUserSettings } from "@camera-path/store";

export function GridSettings() {
  const settings = useUserSettings();
  const save = useUserSettingsActions().save;
  return (
    <label className="flex items-center gap-2 text-xs">
      <input
        checked={settings.showGrid}
        disabled={!settings.ready || settings.saving}
        className="accent-primary"
        onChange={(event) => void save({ show_grid: event.target.checked })}
        type="checkbox"
      />
      Show grid
    </label>
  );
}
