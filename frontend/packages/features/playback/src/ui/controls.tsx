"use client";
import { useEditorActions } from "@camera-path/actions";
import { useCompiledTrajectoryResource } from "@camera-path/api/resources";
import { useSceneInteraction } from "@camera-path/store";

import { trajectoryObjectId } from "@camera-path/types/trajectory-object-id";
import { useTrajectoryPlayback } from "../model/use-trajectory-playback";
import { PlaybackControls as PlaybackControlsView } from "./playback-controls";
export function PlaybackControls() {
  const query = useCompiledTrajectoryResource();
  const expanded =
    useSceneInteraction().selectedObjectId === trajectoryObjectId;
  const select = useEditorActions().selectObject;
  const playback = useTrajectoryPlayback(query.data?.data ?? null);
  return (
    <PlaybackControlsView
      collapsed={!expanded}
      onExpand={
        expanded ? undefined : () => void select({ id: trajectoryObjectId })
      }
      duration={playback.duration}
      embedded
      elapsed={playback.elapsed}
      pathPosition={playback.pathPosition}
      playing={playback.playing}
      onSeek={playback.seek}
      onToggle={playback.toggle}
    />
  );
}
