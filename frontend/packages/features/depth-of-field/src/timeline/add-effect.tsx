"use client";
import { useAddDepthOfFieldKeyframeMutation } from "@camera-path/actions";
import { useAuth } from "@camera-path/api/identity/auth-provider";
import { useDepthOfFieldTimeline } from "@camera-path/api/resources";
import { usePlaybackState } from "@camera-path/store";

import { EffectMenuItem } from "@camera-path/ui-kit/timeline/effect-menu-item";
export function DepthOfFieldEffect() {
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
    <>
      <EffectMenuItem
        disabled={mutation.isPending}
        onSelect={() =>
          mutation.mutate({
            path_position: playback.pathPosition,
            focus: { kind: "center_weighted_9" },
          })
        }
      >
        Depth of Field
      </EffectMenuItem>
      {mutation.error && <p role="alert">{mutation.error.message}</p>}
    </>
  );
}
