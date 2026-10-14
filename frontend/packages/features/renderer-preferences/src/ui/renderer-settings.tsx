"use client";
import { useUserSettings } from "../ports";
import { GaussianDprSelect } from "./gaussian-dpr-select";
export function RendererSettings() {
  const settings = useUserSettings();
  return (
    <>
      <label className="flex items-center gap-2 text-xs">
        <input
          checked={settings.webGpuTileRenderer}
          disabled={!settings.ready || settings.saving}
          className="accent-primary"
          onChange={(event) =>
            void settings.save({ webgpu_tile_renderer: event.target.checked })
          }
          type="checkbox"
        />
        Use WebGPU renderer (off: WebGL)
      </label>
      <GaussianDprSelect />
    </>
  );
}
