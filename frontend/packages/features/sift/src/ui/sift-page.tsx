"use client";
import { Button } from "@camera-path/ui-kit";
import {
  Camera,
  Film,
  Maximize2,
  Minimize2,
  ScanSearch,
  Square,
  Upload,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { DetectorParams, SessionSource } from "../types";
import { useSiftSession } from "./use-sift-session";
import { VideoPlaybackControls } from "./video-playback-controls";

export function SiftPage() {
  const [source, setSource] = useState<SessionSource | null>(null);
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    if (!maximized) return;
    const restore = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMaximized(false);
    };
    window.addEventListener("keydown", restore);
    return () => window.removeEventListener("keydown", restore);
  }, [maximized]);
  const [deviceId, setDeviceId] = useState("");
  const [maxDimension, setMaxDimension] = useState(480);
  const [params, setParams] = useState<DetectorParams>({
    n_octave_layers: 3,
    contrast_threshold: 0.04,
    edge_threshold: 10,
    sigma: 1.6,
    enable_subpixel_localization: true,
    enable_edge_like_filtering: true,
  });
  const {
    container,
    devices,
    frame,
    error,
    phase,
    processedFps,
    repeatDetection,
    playback,
    togglePlayback,
    seekTo,
    stepFrame,
  } = useSiftSession(source, maxDimension, params);
  const active = source !== null;
  return (
    <div
      className={
        maximized
          ? "flex h-full min-h-0 flex-col gap-2 p-2"
          : "flex min-h-full flex-col gap-5 p-5 md:p-8"
      }
    >
      <div className={maximized ? "hidden" : "contents"}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold">
              <ScanSearch className="size-5" /> SIFT lab
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Live keypoints, colored by octave. Frames stay on this device.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setSource({ kind: "camera", deviceId })}>
              <Camera className="mr-2 size-4" />
              {source?.kind === "camera" ? "Restart camera" : "Start camera"}
            </Button>
            <Button
              variant="outline"
              disabled={!active}
              onClick={() => setSource(null)}
            >
              <Square className="mr-2 size-4" />
              Stop
            </Button>
            {source?.kind === "image" && (
              <Button
                variant="outline"
                disabled={!frame}
                onClick={repeatDetection}
              >
                Detect again
              </Button>
            )}
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 text-sm focus-within:ring-2 focus-within:ring-ring">
              <Upload className="size-4" />
              Open image
              <input
                aria-label="Open image"
                type="file"
                accept="image/png,image/jpeg"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) setSource({ kind: "image", file });
                  event.target.value = "";
                }}
              />
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 text-sm focus-within:ring-2 focus-within:ring-ring">
              <Film className="size-4" />
              Open video
              <input
                aria-label="Open video"
                type="file"
                accept="video/*,.mov,.mp4,.m4v"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) setSource({ kind: "video", file });
                  event.target.value = "";
                }}
              />
            </label>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-4 text-xs">
          <label className="grid gap-1">
            Camera
            <select
              aria-label="Camera"
              className="h-9 max-w-64 rounded-md border bg-background px-2"
              value={deviceId}
              onChange={(event) => {
                setDeviceId(event.target.value);
                if (source?.kind === "camera")
                  setSource({ kind: "camera", deviceId: event.target.value });
              }}
            >
              <option value="">Rear / default camera</option>
              {devices.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Camera ${i + 1}`}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            Longest edge
            <select
              aria-label="Longest edge"
              className="h-9 rounded-md border bg-background px-2"
              value={maxDimension}
              onChange={(event) => setMaxDimension(Number(event.target.value))}
            >
              {[320, 480, 640, 960].map((n) => (
                <option key={n} value={n}>
                  {n} px
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            Contrast
            <input
              aria-label="Contrast"
              className="h-9 w-24 rounded-md border bg-background px-2"
              type="number"
              min="0.001"
              max="1"
              step="0.005"
              value={params.contrast_threshold}
              onChange={(event) => {
                const n = event.target.valueAsNumber;
                if (Number.isFinite(n) && n > 0 && n <= 1)
                  setParams({ ...params, contrast_threshold: n });
              }}
            />
          </label>
          <label className="flex h-9 items-center gap-2">
            <input
              type="checkbox"
              checked={params.enable_edge_like_filtering}
              onChange={(event) =>
                setParams({
                  ...params,
                  enable_edge_like_filtering: event.target.checked,
                })
              }
            />
            Edge filter
          </label>
          <label className="flex h-9 items-center gap-2">
            <input
              type="checkbox"
              checked={params.enable_subpixel_localization}
              onChange={(event) =>
                setParams({
                  ...params,
                  enable_subpixel_localization: event.target.checked,
                })
              }
            />
            Subpixel
          </label>
        </div>
        <div
          aria-live="polite"
          className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground"
        >
          <span>Burn · WebGPU</span>
          <span>{active ? phase : "Stopped"}</span>
          {active && frame && (
            <>
              <span>{frame.points.length} keypoints</span>
              <span>
                {frame.width} × {frame.height}
              </span>
              <span>{frame.elapsed.toFixed(1)} ms / detection</span>
              <span>
                {(1000 / Math.max(frame.elapsed, 0.001)).toFixed(1)} detector
                FPS
              </span>
              <span>
                {source?.kind !== "image"
                  ? `${processedFps.toFixed(1)} processed FPS`
                  : "Still image"}
              </span>
            </>
          )}
        </div>
      </div>
      {active && error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {source?.kind === "video" && (
        <VideoPlaybackControls
          name={source.file.name}
          playback={playback}
          onToggle={togglePlayback}
          onSeek={seekTo}
          onStep={stepFrame}
          compact={maximized}
        />
      )}
      <div
        className={
          maximized
            ? "relative order-1 min-h-0 flex-1 overflow-hidden rounded-xl border bg-black"
            : "relative min-h-[360px] flex-1 overflow-hidden rounded-xl border bg-black md:min-h-[500px]"
        }
      >
        {active && (
          <Button
            variant="outline"
            size="icon"
            className="absolute right-3 top-3 z-10"
            aria-label={maximized ? "Restore video size" : "Maximize video"}
            title={maximized ? "Restore video size (Esc)" : "Maximize video"}
            aria-pressed={maximized}
            onClick={() => setMaximized(!maximized)}
          >
            {maximized ? (
              <Minimize2 className="size-4" />
            ) : (
              <Maximize2 className="size-4" />
            )}
          </Button>
        )}
        {maximized && frame && (
          <p className="pointer-events-none absolute left-3 top-3 z-10 rounded bg-black/70 px-2 py-1 text-xs text-white">
            {frame.points.length} keypoints · {frame.elapsed.toFixed(1)} ms
          </p>
        )}
        <div
          ref={container}
          aria-label="Three.js media and keypoint viewer"
          className="absolute inset-0"
        />
        {!active && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white/60">
            Start a camera or open an image or video to inspect keypoints.
          </div>
        )}
      </div>
      <div className={maximized ? "hidden" : "contents"}>
        {active && frame && (
          <div className="flex flex-wrap gap-4 text-xs">
            {Array.from(new Set(frame.points.map((p) => p.octave)))
              .sort((a, b) => a - b)
              .map((octave) => (
                <span key={octave}>
                  Octave {octave}:{" "}
                  {frame.points.filter((p) => p.octave === octave).length}
                </span>
              ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const url = URL.createObjectURL(
                  new Blob([JSON.stringify(frame.points, null, 2)], {
                    type: "application/json",
                  }),
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = "sift-keypoints.json";
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              Save points JSON
            </Button>
          </div>
        )}
        {active && frame?.timings && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">Timing breakdown</summary>
            <p className="mt-2">
              Grayscale {frame.timings.grayscale_ms.toFixed(1)} ms · Pyramid
              setup {frame.timings.pyramid_setup_ms.toFixed(1)} ms · Extrema
              setup {frame.timings.extrema_setup_ms.toFixed(1)} ms · GPU
              submission {frame.timings.gpu_submit_ms.toFixed(1)} ms ·
              Wait/readback {frame.timings.gpu_readback_ms.toFixed(1)} ms ·
              Localization {frame.timings.localization_ms.toFixed(1)} ms ·
              Cleanup {frame.timings.cleanup_ms.toFixed(1)} ms
            </p>
            <p className="mt-1">
              First detections include shader compilation. Submission includes
              Burn optimization and driver work; wait/readback includes GPU
              completion.
            </p>
          </details>
        )}
        <p className="text-xs text-muted-foreground">
          Detection only · no descriptors or matching · Burn WebGPU. For a phone
          camera, use a trusted HTTPS address.
        </p>
      </div>
    </div>
  );
}
