"use client";
import {
  compiledTrajectory,
  playbackState,
  projectPermissions,
} from "@camera-path/contracts/host-data";
import { deleteSpeedKeyframe } from "@camera-path/contracts/host-requests";
import {
  useData,
  useDataQuery,
  useRequestMutation,
} from "@camera-path/extension-api";
import { SpeedGraph } from "../ui/speed-graph";
import { manifest } from "../manifest";
export function TimelineExtension() {
  const trajectory = useDataQuery(manifest, compiledTrajectory);
  const playback = useData(manifest, playbackState);
  const canEdit = useData(manifest, projectPermissions).canEdit;
  const deletion = useRequestMutation(manifest, deleteSpeedKeyframe);
  return (
    <>
      {trajectory.data && (
        <SpeedGraph
          trajectory={trajectory.data.data}
          pathPosition={playback.pathPosition}
          deletingKeyframeId={
            deletion.isPending ? deletion.variables : undefined
          }
          onDeleteKeyframe={(id) => {
            if (canEdit && window.confirm("Delete this speed keyframe?"))
              deletion.mutate(id);
          }}
        />
      )}
      {(deletion.error ?? trajectory.error) && (
        <p role="alert" className="text-xs text-destructive">
          {(deletion.error ?? trajectory.error)?.message}
        </p>
      )}
    </>
  );
}
