"use client";
import { preferencesState } from "@camera-path/contracts/host-data";
import { savePreferences } from "@camera-path/contracts/host-requests";
import { useData, useRequestAction } from "@camera-path/extension-api";
import { manifest } from "../manifest";
export function GridSettings() {
  const settings = useData(manifest, preferencesState);
  const save = useRequestAction(manifest, savePreferences);
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
