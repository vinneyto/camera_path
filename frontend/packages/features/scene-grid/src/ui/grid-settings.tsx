"use client";
import { useUserSettings } from "@camera-path/api/settings";

export function GridSettings() {
  const settings = useUserSettings();
  const save = useUserSettings().save;
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
