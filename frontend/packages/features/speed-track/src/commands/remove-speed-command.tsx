"use client";
import { useDeleteSpeedTimelineMutation } from "@camera-path/actions";
import { useAuth } from "@camera-path/api/identity/auth-provider";
import { useSpeedTimeline } from "@camera-path/api/resources";
import { Command } from "@camera-path/commands";

export function RemoveSpeedCommand() {
  const timeline = useSpeedTimeline();
  const canEdit = useAuth().canEdit;
  const mutation = useDeleteSpeedTimelineMutation();
  const data = timeline.data?.data;
  const exists =
    data &&
    (Object.keys(data.keyframes ?? {}).length > 0 ||
      (data.default_speed ?? 1) !== 1);
  if (!canEdit || !exists) return null;
  return (
    <Command
      id="speed.remove"
      label="Speed: Remove"
      searchText="delete speed timeline track"
      disabled={mutation.isPending}
      actionError={mutation.error?.message}
      onSelect={() => mutation.mutate()}
    />
  );
}
