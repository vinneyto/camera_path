"use client";
import { useSetLidarTimelineMutation } from "@camera-path/actions";
import { useAuth } from "@camera-path/api/identity/auth-provider";
import { useLidarTimelineResource } from "@camera-path/api/resources";

import { EffectMenuItem } from "@camera-path/ui-kit/timeline/effect-menu-item";
export function LidarEffect() {
  const timeline = useLidarTimelineResource();
  const canEdit = useAuth().canEdit;
  const mutation = useSetLidarTimelineMutation();
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
