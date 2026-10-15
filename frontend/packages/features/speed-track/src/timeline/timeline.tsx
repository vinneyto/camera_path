"use client";
import { useDeleteSpeedKeyframeMutation } from "@camera-path/actions";
import { useAuth } from "@camera-path/api/identity/auth-provider";
import { useCompiledTrajectoryResource } from "@camera-path/api/resources";
import { usePlaybackState } from "@camera-path/store";

import { SpeedGraph } from "../ui/speed-graph";
export function SpeedTimeline() {
  const trajectory = useCompiledTrajectoryResource();
  const playback = usePlaybackState();
  const canEdit = useAuth().canEdit;
  const deletion = useDeleteSpeedKeyframeMutation();
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
