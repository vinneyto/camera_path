"use client";

import { Settings } from "lucide-react";
import { useState } from "react";

import { GaussianDprSelect } from "@/features/gaussian-rendering-settings";
import { Button, Modal } from "@/shared/ui";
import { useUserSettings } from "../model/user-settings-provider";

export function UserSettingsPanel() {
  const [open, setOpen] = useState(false);
  const settings = useUserSettings();
  const disabled = !settings.ready || settings.saving;

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Settings"
      trigger={
        <Button
          aria-label="Settings"
          className="size-10 md:size-8"
          size="icon"
          title="Settings"
          variant="ghost"
        >
          <Settings className="size-4" />
        </Button>
      }
    >
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-xs">
          <input
            checked={settings.webGpuTileRenderer}
            disabled={disabled}
            className="accent-primary"
            onChange={(event) =>
              settings.save({ webgpu_tile_renderer: event.target.checked })
            }
            type="checkbox"
          />
          Use WebGPU renderer (off: WebGL)
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input
            checked={settings.showGrid}
            disabled={disabled}
            className="accent-primary"
            onChange={(event) =>
              settings.save({ show_grid: event.target.checked })
            }
            type="checkbox"
          />
          Show grid
        </label>
        <GaussianDprSelect />
      </div>
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
            <Button onClick={settings.retry} size="sm" variant="outline">
              Retry
            </Button>
          )}
        </div>
      )}
    </Modal>
  );
}
