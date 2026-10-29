"use client";
import { useDeleteOrientationTimelineMutation } from "@camera-path/actions";
import { useAuth } from "@camera-path/api/identity/auth-provider";
import { useOrientationTimeline } from "@camera-path/api/resources";
import { Command } from "@camera-path/commands";

export function RemoveOrientationCommand() {
  const timeline = useOrientationTimeline();
  const canEdit = useAuth().canEdit;
  const mutation = useDeleteOrientationTimelineMutation();
  const data = timeline.data?.data;
  const exists =
    data &&
    (Object.keys(data.keyframes ?? {}).length > 0 ||
      (data.default_orientation?.yaw_deg ?? 0) !== 0 ||
      (data.default_orientation?.pitch_deg ?? 0) !== 0 ||
      (data.default_orientation?.roll_deg ?? 0) !== 0);
  if (!canEdit || !exists) return null;
  return (
    <Command
      id="orientation.remove"
      label="Orientation: Remove"
      searchText="delete orientation timeline track"
      disabled={mutation.isPending}
      actionError={mutation.error?.message}
      onSelect={() => mutation.mutate()}
    />
  );
}
