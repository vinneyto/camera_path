"use client";

import { UserRound } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button, Modal } from "@/shared/ui";
import { useUserSettings } from "../model/user-settings-provider";

interface UserSettingsPanelProps {
  children?: ReactNode;
}

export function UserSettingsPanel({ children }: UserSettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const settings = useUserSettings();
  const disabled = !settings.ready || settings.saving;

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Profile settings"
      trigger={
        <Button
          aria-label="Profile settings"
          size="icon"
          title="Profile settings"
          variant="ghost"
        >
          <UserRound className="size-3.5" />
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
          WebGPU tile renderer (experimental)
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
      {children}
    </Modal>
  );
}
