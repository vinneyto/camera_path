"use client";
import type { CompiledTrajectory } from "@camera-path/trajectory-math";
import { useTrajectoryPlayback } from "@host/editor";
import { PlaybackControls } from "@host/ui/trajectory-panels";

interface PlaybackControlsContainerProps {
  collapsed: boolean;
  onExpand?: () => void;
  trajectory: CompiledTrajectory;
}

export function PlaybackControlsContainer({
  collapsed,
  onExpand,
  trajectory,
}: PlaybackControlsContainerProps) {
  const playback = useTrajectoryPlayback(trajectory);

  return (
    <PlaybackControls
      collapsed={collapsed}
      duration={playback.duration}
      embedded
      elapsed={playback.elapsed}
      onExpand={onExpand}
      onSeek={playback.seek}
      onToggle={playback.toggle}
      pathPosition={playback.pathPosition}
      playing={playback.playing}
    />
  );
}
