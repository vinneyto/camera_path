"use client";
import { useCreateDepthOfFieldTimelineMutation } from "@camera-path/actions";
import { useAuth } from "@camera-path/api/identity/auth-provider";
import {
  useDepthOfFieldTimeline,
  useTrajectoryGeometry,
} from "@camera-path/api/resources";
import { useSceneInteraction } from "@camera-path/store";

import { trajectoryObjectId } from "@camera-path/types/trajectory-object-id";
import { Command } from "@camera-path/commands";
export function AddDepthOfFieldCommand() {
  const timeline = useDepthOfFieldTimeline();
  const selected = useSceneInteraction().selectedObjectId;
  const trajectory = useTrajectoryGeometry();
  const canEdit = useAuth().canEdit;
  const mutation = useCreateDepthOfFieldTimelineMutation();
  if (
    !canEdit ||
    selected !== trajectoryObjectId ||
    !trajectory.data?.data.segments?.length ||
    !timeline.data ||
    Object.keys(timeline.data.data.keyframes ?? {}).length
  )
    return null;
  return (
    <Command
      id="depth-of-field.add"
      label="Depth of Field: Add"
      searchText="dof focus autofocus effect"
      disabled={mutation.isPending}
      actionError={mutation.error?.message}
      onSelect={() => mutation.mutate()}
    />
  );
}
