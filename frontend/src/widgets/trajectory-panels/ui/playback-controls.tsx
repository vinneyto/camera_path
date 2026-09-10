import { ChevronUp, Pause, Play, RotateCcw } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui";

interface PlaybackControlsProps {
  collapsed?: boolean;
  duration: number;
  embedded?: boolean;
  elapsed: number;
  onExpand?: () => void;
  pathPosition: number;
  playing: boolean;
  onSeek: (position: number) => void;
  onToggle: () => void;
}

export function PlaybackControls({
  collapsed = false,
  duration,
  embedded = false,
  elapsed,
  onExpand,
  pathPosition,
  playing,
  onSeek,
  onToggle,
}: PlaybackControlsProps) {
  return (
    <div
      className={cn(
        "flex h-10 items-center gap-2 px-3",
        !embedded && "border-t bg-background/95 backdrop-blur",
      )}
    >
      <Button
        aria-label={playing ? "Pause" : "Play"}
        onClick={onToggle}
        size="icon"
        variant="ghost"
      >
        {playing ? (
          <Pause className="size-3.5" />
        ) : (
          <Play className="size-3.5" />
        )}
      </Button>
      <Button
        aria-label="Restart"
        onClick={() => onSeek(0)}
        size="icon"
        variant="ghost"
      >
        <RotateCcw className="size-3.5" />
      </Button>
      <input
        aria-label="Playback position"
        className={cn(
          "h-1 flex-1 cursor-pointer accent-orange-500",
          collapsed && "-translate-y-px",
        )}
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
      {onExpand && (
        <Button
          aria-label="Expand trajectory controls"
          onClick={onExpand}
          size="icon"
          title="Expand trajectory controls"
          variant="ghost"
        >
          <ChevronUp className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
