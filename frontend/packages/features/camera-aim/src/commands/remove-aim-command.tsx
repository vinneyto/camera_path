"use client";
import { useDeleteAimTimelineMutation } from "@camera-path/actions";
import { useAuth } from "@camera-path/api/identity/auth-provider";
import { useAimTimeline } from "@camera-path/api/resources";
import { Command } from "@camera-path/commands";

export function RemoveAimCommand() {
  const timeline = useAimTimeline();
  const canEdit = useAuth().canEdit;
  const mutation = useDeleteAimTimelineMutation();
  const data = timeline.data?.data;
  const exists =
    data &&
    (Object.keys(data.keyframes ?? {}).length > 0 ||
      data.default_aim?.kind === "look_at_point" ||
      (data.default_aim &&
        "direction" in data.default_aim &&
        data.default_aim.direction === "backward") ||
      data.world_up?.some((value, index) => value !== [0, 1, 0][index]));
  if (!canEdit || !exists) return null;
  return (
    <Command
      id="aim.remove"
      label="Aim: Remove"
      searchText="delete aim timeline track"
      disabled={mutation.isPending}
      actionError={mutation.error?.message}
      onSelect={() => mutation.mutate()}
    />
  );
}
