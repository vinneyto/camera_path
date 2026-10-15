"use client";
import { useDeleteCameraKeyframeMutation } from "@camera-path/actions";
import { useAuth } from "@camera-path/api/identity/auth-provider";
import {
  useCompiledTrajectoryResource,
  useScenePoints,
} from "@camera-path/api/resources";

import { TimelineLane } from "@camera-path/ui-kit/timeline/timeline-lane";
import { createAimTrack } from "./create-aim-track";
export function CameraAimTimeline() {
  const trajectory = useCompiledTrajectoryResource();
  const canEdit = useAuth().canEdit;
  const deletion = useDeleteCameraKeyframeMutation();
  const points = useScenePoints();

  const compiled = trajectory.data?.data;
  const track = compiled
    ? createAimTrack({
        project: {
          scene_points: Object.fromEntries(
            (points.data?.data ?? []).map((p) => [p.id, p]),
          ),
        },
        trajectory: compiled,
        deletingKeyframeId: deletion.isPending ? deletion.variables : undefined,
        onDeleteKeyframe: (id) => {
          if (canEdit && window.confirm("Delete this camera aim keyframe?"))
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
