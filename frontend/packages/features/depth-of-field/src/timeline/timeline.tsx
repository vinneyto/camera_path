"use client";
import { useDeleteDepthOfFieldKeyframeMutation } from "@camera-path/actions";
import { useAuth } from "@camera-path/api/identity/auth-provider";
import {
  useCompiledTrajectoryResource,
  useScenePoints,
} from "@camera-path/api/resources";

import { TimelineLane } from "@camera-path/ui-kit/timeline/timeline-lane";
import { createDepthOfFieldTrack } from "./create-depth-of-field-track";
export function DepthOfFieldTimeline() {
  const trajectory = useCompiledTrajectoryResource();
  const canEdit = useAuth().canEdit;
  const deletion = useDeleteDepthOfFieldKeyframeMutation();
  const points = useScenePoints();

  const compiled = trajectory.data?.data;
  const track = compiled
    ? createDepthOfFieldTrack({
        project: {
          scene_points: Object.fromEntries(
            (points.data?.data ?? []).map((p) => [p.id, p]),
          ),
        },
        trajectory: compiled,
        deletingKeyframeId: deletion.isPending ? deletion.variables : undefined,
        onDeleteKeyframe: (id) => {
          if (canEdit && window.confirm("Delete this depth of field keyframe?"))
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
