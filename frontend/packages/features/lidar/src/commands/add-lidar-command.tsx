"use client";
import { useSetLidarTimelineMutation } from "@camera-path/actions";
import { useAuth } from "@camera-path/api/identity/auth-provider";
import {
  useLidarTimelineResource,
  useTrajectoryGeometry,
} from "@camera-path/api/resources";

import { useSceneInteraction } from "@camera-path/store";
import { trajectoryObjectId } from "@camera-path/types/trajectory-object-id";
import { Command } from "@camera-path/commands";
export function AddLidarCommand() {
  const selected = useSceneInteraction().selectedObjectId;
  const trajectory = useTrajectoryGeometry();
  const timeline = useLidarTimelineResource();
  const canEdit = useAuth().canEdit;
  const mutation = useSetLidarTimelineMutation();
  if (
    !canEdit ||
    selected !== trajectoryObjectId ||
    !trajectory.data?.data.segments?.length ||
    !timeline.data ||
    timeline.data.data.lidar_keyframe
  )
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
