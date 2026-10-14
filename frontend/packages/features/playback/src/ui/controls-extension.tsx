"use client";
import {
  compiledTrajectory,
  sceneInteraction,
} from "@camera-path/contracts/host-data";
import { selectObject } from "@camera-path/contracts/host-requests";
import { trajectoryObjectId } from "@camera-path/contracts/trajectory-object-id";
import {
  useData,
  useDataQuery,
  useRequestAction,
} from "@camera-path/extension-api";
import { manifest } from "../manifest";
import { useTrajectoryPlayback } from "../model/use-trajectory-playback";
import { PlaybackControls } from "./playback-controls";
export function ControlsExtension() {
  const query = useDataQuery(manifest, compiledTrajectory);
  const expanded =
    useData(manifest, sceneInteraction).selectedObjectId === trajectoryObjectId;
  const select = useRequestAction(manifest, selectObject);
  const playback = useTrajectoryPlayback(query.data?.data ?? null);
  return (
    <PlaybackControls
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
