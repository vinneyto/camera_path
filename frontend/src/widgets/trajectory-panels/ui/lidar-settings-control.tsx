"use client";
import { useState } from "react";
import type { LidarSettings } from "@/shared/api/generated/model";
import { Button } from "@/shared/ui";

interface LidarSettingsControlProps {
  settings: LidarSettings;
  pending: boolean;
  onSave: (settings: LidarSettings) => void;
}

export function LidarSettingsControl({
  settings,
  pending,
  onSave,
}: LidarSettingsControlProps) {
  const [verticalFov, setVerticalFov] = useState(
    String(settings.vertical_fov_deg),
  );
  const [width, setWidth] = useState(String(settings.horizontal_resolution));
  const [height, setHeight] = useState(String(settings.vertical_resolution));
  const fov = Number(verticalFov),
    w = Number(width),
    h = Number(height);
  const valid =
    Number.isFinite(fov) &&
    fov > 0 &&
    fov < 180 &&
    Number.isInteger(w) &&
    w >= 1 &&
    w <= 4096 &&
    Number.isInteger(h) &&
    h >= 1 &&
    h <= 256;
  return (
    <form
      className="flex flex-wrap items-end gap-2 border-t px-2 py-2 text-[10px]"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid)
          onSave({
            vertical_fov_deg: fov,
            horizontal_resolution: w,
            vertical_resolution: h,
          });
      }}
    >
      <label className="grid gap-1">
        Vertical angle (°)
        <input
          className="w-24 rounded border bg-background px-1 py-1"
          type="number"
          min="0.1"
          max="179.9"
          step="any"
          value={verticalFov}
          onChange={(event) => setVerticalFov(event.target.value)}
        />
      </label>
      <label className="grid gap-1">
        Azimuth samples
        <input
          className="w-24 rounded border bg-background px-1 py-1"
          type="number"
          min="1"
          max="4096"
          value={width}
          onChange={(event) => setWidth(event.target.value)}
        />
      </label>
      <label className="grid gap-1">
        Elevation samples
        <input
          className="w-24 rounded border bg-background px-1 py-1"
          type="number"
          min="1"
          max="256"
          value={height}
          onChange={(event) => setHeight(event.target.value)}
        />
      </label>
      <Button size="sm" disabled={pending || !valid} type="submit">
        Apply LiDAR settings
      </Button>
      <p className="w-full text-muted-foreground">
        360° horizontally, ±{valid ? fov / 2 : "…"}° vertically. Static settings
        for the whole trajectory. Experimental: uses the main view’s loaded
        Gaussian selection.
      </p>
    </form>
  );
}
