"use client";
import {
  depthOfFieldTimeline,
  playbackState,
  projectPermissions,
} from "@camera-path/contracts/host-data";
import { addDepthOfFieldKeyframe } from "@camera-path/contracts/host-requests";
import {
  useData,
  useDataQuery,
  useRequestMutation,
} from "@camera-path/extension-api";
import { EffectMenuItem } from "@camera-path/ui-kit/timeline/effect-menu-item";
import { manifest } from "../manifest";
export function EffectExtension() {
  const timeline = useDataQuery(manifest, depthOfFieldTimeline);
  const playback = useData(manifest, playbackState);
  const canEdit = useData(manifest, projectPermissions).canEdit;
  const mutation = useRequestMutation(manifest, addDepthOfFieldKeyframe);
  if (
    !canEdit ||
    !timeline.data ||
    Object.keys(timeline.data.data.keyframes ?? {}).length
  )
    return null;
  return (
    <>
      <EffectMenuItem
        disabled={mutation.isPending}
        onSelect={() =>
          mutation.mutate({
            path_position: playback.pathPosition,
            focus: { kind: "center_weighted_9" },
          })
        }
      >
        Depth of Field
      </EffectMenuItem>
      {mutation.error && <p role="alert">{mutation.error.message}</p>}
    </>
  );
}
