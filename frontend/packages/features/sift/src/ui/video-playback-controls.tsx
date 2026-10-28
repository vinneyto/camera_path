"use client";
import { Button } from "@camera-path/ui-kit";
import { Pause, Play, RotateCcw, StepBack, StepForward } from "lucide-react";
import type { VideoPlaybackState } from "../types";
import { formatVideoTime } from "./format-video-time";

interface VideoPlaybackControlsProps {
  name: string;
  playback: VideoPlaybackState | null;
  onToggle: () => void;
  onSeek: (seconds: number) => void;
  onStep: (direction: -1 | 1) => void;
  compact?: boolean;
}

export function VideoPlaybackControls({
  name,
  playback,
  onToggle,
  onSeek,
  onStep,
  compact = false,
}: VideoPlaybackControlsProps) {
  const duration = playback?.duration ?? 0;
  const time = Math.min(playback?.currentTime ?? 0, duration);
  const frameIndex = playback?.frameIndex ?? null;
  const frameCount = playback?.frameCount ?? 0;
  const label = playback?.ended
    ? "Replay video"
    : playback?.paused === false
      ? "Pause video"
      : "Play video";
  const Icon = playback?.ended
    ? RotateCcw
    : playback?.paused === false
      ? Pause
      : Play;
  return (
    <section
      aria-label="Video playback"
      className={
        compact
          ? "order-2 shrink-0 rounded-xl border p-2"
          : "grid gap-3 rounded-xl border p-3"
      }
    >
      {!compact && (
        <p className="truncate text-sm" title={name}>
          {name}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!playback}
          aria-label={label}
          onClick={onToggle}
        >
          <Icon className="size-4" />
          <span className={compact ? "sr-only" : ""}>
            {playback?.ended
              ? "Replay"
              : playback?.paused === false
                ? "Pause"
                : "Play"}
          </span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          aria-label="Previous frame"
          title="Previous frame"
          disabled={frameIndex === null || frameIndex === 0}
          onClick={() => onStep(-1)}
        >
          <StepBack className="size-4" />
          <span className="sr-only">Previous frame</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          aria-label="Next frame"
          title="Next frame"
          disabled={frameIndex === null || frameIndex >= frameCount - 1}
          onClick={() => onStep(1)}
        >
          <StepForward className="size-4" />
          <span className="sr-only">Next frame</span>
        </Button>
        <input
          aria-label="Video position"
          aria-valuetext={`${formatVideoTime(time)} of ${formatVideoTime(duration)}`}
          type="range"
          min={0}
          max={duration || 1}
          step={0.01}
          value={time}
          disabled={!playback || duration <= 0}
          onChange={(event) => onSeek(event.target.valueAsNumber)}
          className="min-w-16 flex-1 accent-primary"
        />
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {formatVideoTime(time)} / {formatVideoTime(duration)}
        </span>
        <span
          className="text-xs tabular-nums text-muted-foreground"
          title={`${time.toFixed(3)} s`}
        >
          {frameIndex !== null
            ? `Frame ${frameIndex + 1} / ${frameCount}`
            : (playback?.frameStepError ?? "Indexing frames…")}
        </span>
      </div>
    </section>
  );
}
