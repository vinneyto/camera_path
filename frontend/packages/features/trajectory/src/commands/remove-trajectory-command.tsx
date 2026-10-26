"use client";
import { useClearTrajectoryMutation } from "@camera-path/actions";
import { useAuth } from "@camera-path/api/identity/auth-provider";
import { useTrajectoryGeometry } from "@camera-path/api/resources";
import { Command } from "@camera-path/commands";
import { useSceneInteraction } from "@camera-path/store";
import { trajectoryObjectId } from "@camera-path/types/trajectory-object-id";

export function RemoveTrajectoryCommand() {
  const canEdit = useAuth().canEdit;
  const selected = useSceneInteraction().selectedObjectId;
  const trajectory = useTrajectoryGeometry();
  const mutation = useClearTrajectoryMutation();
  if (
    !canEdit ||
    selected !== trajectoryObjectId ||
    !trajectory.data?.data.segments?.length
  )
    return null;
  return (
    <Command
      id="trajectory.remove"
      label="Trajectory: Remove"
      searchText="delete path"
      disabled={mutation.isPending}
      actionError={mutation.error?.message}
      onSelect={() => mutation.mutate()}
    />
  );
}
