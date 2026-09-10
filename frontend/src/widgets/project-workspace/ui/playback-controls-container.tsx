"use client";

import type { CompiledTrajectory } from "@/entities/trajectory";
import { useTrajectoryPlayback } from "@/features/project-editor";
import { PlaybackControls } from "@/widgets/trajectory-panels";

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
