"use client";
import {
  lidarTimeline,
  projectPermissions,
} from "@camera-path/contracts/host-data";
import { setLidarTimeline } from "@camera-path/contracts/host-requests";
import {
  useData,
  useDataQuery,
  useRequestMutation,
} from "@camera-path/extension-api";
import { EffectMenuItem } from "@camera-path/ui-kit/timeline/effect-menu-item";
import { manifest } from "../manifest";
export function EffectExtension() {
  const timeline = useDataQuery(manifest, lidarTimeline);
  const canEdit = useData(manifest, projectPermissions).canEdit;
  const mutation = useRequestMutation(manifest, setLidarTimeline);
  if (!canEdit || !timeline.data || timeline.data.data.lidar_keyframe)
    return null;
  return (
    <>
      <EffectMenuItem
        disabled={mutation.isPending}
        onSelect={() => mutation.mutate({})}
      >
        LiDAR
      </EffectMenuItem>
      {mutation.error && <p role="alert">{mutation.error.message}</p>}
    </>
  );
}
