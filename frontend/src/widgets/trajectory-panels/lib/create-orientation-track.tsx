import type { CompiledTrajectory } from "@/entities/trajectory";

import type { KeyframeTrackDescriptor } from "../model/timeline-track";

interface CreateOrientationTrackOptions {
  deletingKeyframeId?: string;
  onDeleteKeyframe: (keyframeId: string) => void;
  trajectory: CompiledTrajectory;
}

export function createOrientationTrack({
  deletingKeyframeId,
  onDeleteKeyframe,
  trajectory,
}: CreateOrientationTrackOptions): KeyframeTrackDescriptor {
  const keyframes = trajectory.camera_track.orientation_keyframes.map(
    (keyframe) => {
      const {
        pitch_deg: pitch,
        roll_deg: roll,
        yaw_deg: yaw,
      } = keyframe.orientation;
      const tooltip = [
        `Yaw ${yaw.toFixed(1)}°`,
        `Pitch ${pitch.toFixed(1)}°`,
        `Roll ${roll.toFixed(1)}°`,
        keyframe.interpolation_to_next,
      ].join(" · ");
      return {
        ariaLabel: `${tooltip} at ${Math.round(keyframe.path_position * 100)}%`,
        id: keyframe.id,
        pathPosition: keyframe.path_position,
        tooltip,
      };
    },
  );

  return {
    color: "var(--chart-orientation)",
    deleteLabel: "Delete camera orientation keyframe",
    deletingKeyframeId,
    emptyState: keyframes.length === 0 ? "Default orientation" : null,
    height: 24,
    id: "camera-orientation",
    keyframes,
    lineY: 10,
    onDeleteKeyframe,
    renderMarker: () => (
      <span className="absolute inset-[5px] rounded-full border-2 border-[var(--chart-orientation)] bg-card shadow-sm" />
    ),
    summary: keyframes.length ? `${keyframes.length} keys` : "Default only",
    title: "Orientation",
  };
}
