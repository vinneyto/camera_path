"use client";
import { useAddDepthOfFieldKeyframeMutation } from "@camera-path/actions";
import { useAuth } from "@camera-path/api/identity/auth-provider";
import { useDepthOfFieldTimeline } from "@camera-path/api/resources";
import { usePlaybackState } from "@camera-path/store";

import { Command } from "@camera-path/commands";
export function AddDepthOfFieldCommand() {
  const timeline = useDepthOfFieldTimeline();
  const playback = usePlaybackState();
  const canEdit = useAuth().canEdit;
  const mutation = useAddDepthOfFieldKeyframeMutation();
  if (
    !canEdit ||
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
      onSelect={() =>
        mutation.mutate({
          path_position: playback.pathPosition,
          focus: { kind: "center_weighted_9" },
        })
      }
    />
  );
}
