"use client";
import { useUserSettingsActions } from "@camera-path/actions";
import { useUserSettings } from "@camera-path/store";
import { Button } from "@camera-path/ui-kit";
import { GaussianDprSelect } from "./gaussian-dpr-select";
export function RendererSettings() {
  const settings = useUserSettings();
  const actions = useUserSettingsActions();
  return (
    <>
      <label className="flex items-center gap-2 text-xs">
        <input
          checked={settings.webGpuTileRenderer}
          disabled={!settings.ready || settings.saving}
          className="accent-primary"
          onChange={(event) =>
            void actions.save({ webgpu_tile_renderer: event.target.checked })
          }
          type="checkbox"
        />
        Use WebGPU renderer (off: WebGL)
      </label>
      <GaussianDprSelect />
      {(settings.loading || settings.saving) && (
        <p className="mt-3 text-xs text-muted-foreground" role="status">
          {settings.loading ? "Loading settings…" : "Saving…"}
        </p>
      )}
      {settings.error && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-destructive" role="alert">
            {settings.error.message}
          </p>
          {!settings.ready && (
            <Button onClick={actions.retry} size="sm" variant="outline">
              Retry
            </Button>
          )}
        </div>
      )}
    </>
  );
}
