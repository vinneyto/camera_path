import { Pause, Play, RotateCcw } from "lucide-react";

import { Button } from "@/shared/ui";

interface PlaybackControlsProps {
  duration: number;
  elapsed: number;
  pathPosition: number;
  playing: boolean;
  onSeek: (position: number) => void;
  onToggle: () => void;
}

export function PlaybackControls({
  duration,
  elapsed,
  pathPosition,
  playing,
  onSeek,
  onToggle,
}: PlaybackControlsProps) {
  return (
    <div className="flex h-10 items-center gap-2 border-t bg-background/95 px-3 backdrop-blur">
      <Button aria-label={playing ? "Pause" : "Play"} onClick={onToggle} size="icon" variant="ghost">
        {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
      </Button>
      <Button aria-label="Restart" onClick={() => onSeek(0)} size="icon" variant="ghost">
        <RotateCcw className="size-3.5" />
      </Button>
      <input
        aria-label="Playback position"
        className="h-1 flex-1 cursor-pointer accent-orange-500"
        max={1}
        min={0}
        onChange={(event) => onSeek(Number(event.target.value))}
        step={0.001}
        type="range"
        value={pathPosition}
      />
      <span className="w-20 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
        {elapsed.toFixed(1)} / {duration.toFixed(1)} s
      </span>
    </div>
  );
}
