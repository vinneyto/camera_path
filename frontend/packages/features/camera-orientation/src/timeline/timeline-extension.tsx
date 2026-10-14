"use client";
import {
  compiledTrajectory,
  projectPermissions,
} from "@camera-path/contracts/host-data";
import { deleteCameraOrientationKeyframe } from "@camera-path/contracts/host-requests";
import {
  useData,
  useDataQuery,
  useRequestMutation,
} from "@camera-path/extension-api";
import { TimelineLane } from "@camera-path/ui-kit/timeline/timeline-lane";
import { manifest } from "../manifest";
import { createOrientationTrack } from "./create-orientation-track";
export function TimelineExtension() {
  const trajectory = useDataQuery(manifest, compiledTrajectory);
  const canEdit = useData(manifest, projectPermissions).canEdit;
  const deletion = useRequestMutation(
    manifest,
    deleteCameraOrientationKeyframe,
  );

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
