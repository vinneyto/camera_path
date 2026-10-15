"use client";
import { useDeleteCameraOrientationKeyframeMutation } from "@camera-path/actions";
import { useAuth } from "@camera-path/api/identity/auth-provider";
import { useCompiledTrajectoryResource } from "@camera-path/api/resources";

import { TimelineLane } from "@camera-path/ui-kit/timeline/timeline-lane";
import { createOrientationTrack } from "./create-orientation-track";
export function CameraOrientationTimeline() {
  const trajectory = useCompiledTrajectoryResource();
  const canEdit = useAuth().canEdit;
  const deletion = useDeleteCameraOrientationKeyframeMutation();

  const compiled = trajectory.data?.data;
  const track = compiled
    ? createOrientationTrack({
        trajectory: compiled,
        deletingKeyframeId: deletion.isPending ? deletion.variables : undefined,
        onDeleteKeyframe: (id) => {
          if (
            canEdit &&
            window.confirm("Delete this camera orientation keyframe?")
          )
            deletion.mutate(id);
        },
      })
    : null;
  return (
    <TimelineLane
      track={track?.keyframes.length ? track : null}
      error={deletion.error ?? trajectory.error}
    />
  );
}
