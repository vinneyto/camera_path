"use client";

import { useUserSettings } from "@/features/user-settings";

export function GaussianDprSelect() {
  const settings = useUserSettings();

  return (
    <label className="flex h-7 items-center gap-1.5 rounded-md border bg-background px-2 text-[10px] text-muted-foreground">
      <span>Gaussian DPR</span>
      <select
        aria-label="Gaussian DPR"
        className="bg-transparent text-[10px] font-medium text-foreground outline-none"
        disabled={!settings.ready || settings.saving}
        onChange={(event) =>
          settings.save({
            gaussian_dpr: event.target.value === "system" ? "system" : "1x",
          })
        }
        value={settings.gaussianDpr}
      >
        <option value="1x">1×</option>
        <option value="system">System</option>
      </select>
    </label>
  );
}
