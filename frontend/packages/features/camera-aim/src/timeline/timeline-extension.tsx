"use client";
import {
  compiledTrajectory,
  projectPermissions,
  scenePoints,
} from "@camera-path/contracts/host-data";
import { deleteCameraKeyframe } from "@camera-path/contracts/host-requests";
import {
  useData,
  useDataQuery,
  useRequestMutation,
} from "@camera-path/extension-api";
import { TimelineLane } from "@camera-path/ui-kit/timeline/timeline-lane";
import { manifest } from "../manifest";
import { createAimTrack } from "./create-aim-track";
export function TimelineExtension() {
  const trajectory = useDataQuery(manifest, compiledTrajectory);
  const canEdit = useData(manifest, projectPermissions).canEdit;
  const deletion = useRequestMutation(manifest, deleteCameraKeyframe);
  const points = useDataQuery(manifest, scenePoints);

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
