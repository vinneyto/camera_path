"use client";

import { useGaussianRenderingSettingsStore } from "../model/gaussian-rendering-settings-store";

export function GaussianDprSelect() {
  const dprMode = useGaussianRenderingSettingsStore((state) => state.dprMode);
  const setDprMode = useGaussianRenderingSettingsStore(
    (state) => state.setDprMode,
  );

  return (
    <label className="flex h-7 items-center gap-1.5 rounded-md border bg-background px-2 text-[10px] text-muted-foreground">
      <span>Gaussian DPR</span>
      <select
        aria-label="Gaussian DPR"
        className="bg-transparent text-[10px] font-medium text-foreground outline-none"
        onChange={(event) =>
          setDprMode(event.target.value === "system" ? "system" : "1x")
        }
        value={dprMode}
      >
        <option value="1x">1×</option>
        <option value="system">System</option>
      </select>
    </label>
  );
}
