"use client";

import { Settings2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/shared/ui";

import { useGaussianRenderingSettingsStore } from "../model/gaussian-rendering-settings-store";

export function RenderingSettingsPanel() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const enabled = useGaussianRenderingSettingsStore(
    (state) => state.webGpuTileRenderer,
  );
  const setEnabled = useGaussianRenderingSettingsStore(
    (state) => state.setWebGpuTileRenderer,
  );

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
        aria-controls="rendering-settings-panel"
        aria-expanded={open}
        aria-label="Settings"
        onClick={() => setOpen((current) => !current)}
        size="icon"
        title="Settings"
        variant="ghost"
      >
        <Settings2 className="size-3.5" />
      </Button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-64 rounded-lg border bg-background p-3 shadow-lg"
          id="rendering-settings-panel"
        >
          <h2 className="mb-3 text-xs font-semibold">Settings</h2>
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <input
              checked={enabled}
              className="accent-primary"
              onChange={(event) => setEnabled(event.target.checked)}
              type="checkbox"
            />
            WebGPU tile renderer (experimental)
          </label>
        </div>
      )}
    </div>
  );
}
