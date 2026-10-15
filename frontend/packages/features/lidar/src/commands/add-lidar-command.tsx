"use client";
import { useSetLidarTimelineMutation } from "@camera-path/actions";
import { useAuth } from "@camera-path/api/identity/auth-provider";
import { useLidarTimelineResource } from "@camera-path/api/resources";

import { Command } from "@camera-path/commands";
export function AddLidarCommand() {
  const timeline = useLidarTimelineResource();
  const canEdit = useAuth().canEdit;
  const mutation = useSetLidarTimelineMutation();
  if (!canEdit || !timeline.data || timeline.data.data.lidar_keyframe)
    return null;
  return (
    <Command
      id="lidar.add"
      label="LiDAR: Add"
      searchText="sensor effect"
      disabled={mutation.isPending}
      actionError={mutation.error?.message}
      onSelect={() => mutation.mutate({})}
    />
  );
}
