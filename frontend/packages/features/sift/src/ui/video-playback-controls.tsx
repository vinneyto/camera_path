"use client";
import { Button } from "@camera-path/ui-kit";
import { Pause, Play, RotateCcw } from "lucide-react";
import type { VideoPlaybackState } from "../types";
import { formatVideoTime } from "./format-video-time";

interface VideoPlaybackControlsProps {
  name: string;
  playback: VideoPlaybackState | null;
  onToggle: () => void;
  onSeek: (seconds: number) => void;
}

export function VideoPlaybackControls({
  name,
  playback,
  onToggle,
  onSeek,
}: VideoPlaybackControlsProps) {
  const duration = playback?.duration ?? 0;
  const time = Math.min(playback?.currentTime ?? 0, duration);
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
      className="grid gap-3 rounded-xl border p-3"
    >
      <p className="truncate text-sm" title={name}>
        {name}
      </p>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={!playback}
          aria-label={label}
          onClick={onToggle}
        >
          <Icon className="mr-2 size-4" />
          {playback?.ended
            ? "Replay"
            : playback?.paused === false
              ? "Pause"
              : "Play"}
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
          className="min-w-0 flex-1 accent-primary"
        />
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {formatVideoTime(time)} / {formatVideoTime(duration)}
        </span>
      </div>
    </section>
  );
}
