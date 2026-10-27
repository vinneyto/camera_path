"use client";
import { useDeleteDepthOfFieldTimelineMutation } from "@camera-path/actions";
import { useAuth } from "@camera-path/api/identity/auth-provider";
import { useDepthOfFieldTimeline } from "@camera-path/api/resources";
import { Command } from "@camera-path/commands";

export function RemoveDepthOfFieldCommand() {
  const timeline = useDepthOfFieldTimeline();
  const canEdit = useAuth().canEdit;
  const mutation = useDeleteDepthOfFieldTimelineMutation();
  if (!canEdit || !Object.keys(timeline.data?.data.keyframes ?? {}).length)
    return null;
  return (
    <Command
      id="depth-of-field.remove"
      label="Depth of Field: Remove"
      searchText="delete dof focus autofocus effect"
      disabled={mutation.isPending}
      actionError={mutation.error?.message}
      onSelect={() => mutation.mutate()}
    />
  );
}
