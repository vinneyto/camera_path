"use client";

import { UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/shared/ui";
import { useUserSettings } from "../model/user-settings-provider";

export function UserSettingsPanel() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const settings = useUserSettings();
  const disabled = !settings.ready || settings.saving;

  useEffect(() => {
    if (!open) return;
    function closeOnOutsideClick(event: PointerEvent) {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <Button
        aria-controls="user-settings-panel"
        aria-expanded={open}
        aria-label="Profile settings"
        onClick={() => setOpen((current) => !current)}
        size="icon"
        title="Profile settings"
        variant="ghost"
      >
        <UserRound className="size-3.5" />
      </Button>
      {open && (
        <div
          className="absolute right-0 top-full z-10 mt-1 w-72 rounded-lg border bg-background p-3 shadow-lg"
          id="user-settings-panel"
        >
          <h2 className="mb-3 text-xs font-semibold">Profile settings</h2>
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
        </div>
      )}
    </div>
  );
}
