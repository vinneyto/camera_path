import {
  evaluateCameraOrientation,
  type CompiledTrajectory,
} from "@/entities/trajectory";

import type { ScalarTrackDescriptor } from "../model/timeline-track";

interface CreateOrientationTracksOptions {
  deletingKeyframeId?: string;
  onDeleteKeyframe: (keyframeId: string) => void;
  pathPosition: number;
  trajectory: CompiledTrajectory;
}

export function createOrientationTracks({
  deletingKeyframeId,
  onDeleteKeyframe,
  pathPosition,
  trajectory,
}: CreateOrientationTracksOptions): ScalarTrackDescriptor[] {
  const channels = [
    {
      color: "var(--chart-yaw)",
      field: "yaw_deg",
      id: "camera-yaw",
      title: "Yaw",
    },
    {
      color: "var(--chart-pitch)",
      field: "pitch_deg",
      id: "camera-pitch",
      title: "Pitch",
    },
    {
      color: "var(--chart-roll)",
      field: "roll_deg",
      id: "camera-roll",
      title: "Roll",
    },
  ] as const;
  const samples = Array.from({ length: 65 }, (_, index) => {
    const samplePosition = index / 64;
    return {
      orientation: evaluateCameraOrientation(trajectory, samplePosition),
      pathPosition: samplePosition,
    };
  });
  const current = evaluateCameraOrientation(trajectory, pathPosition);

  return channels.map((channel) => {
    const values = samples.map((sample) => sample.orientation[channel.field]);
    const minimum = Math.min(0, ...values);
    const maximum = Math.max(0, ...values);
    const span = Math.max(10, maximum - minimum);
    const domain = [minimum - span * 0.08, maximum + span * 0.08] as const;
    const keyframes = trajectory.camera_track.orientation_keyframes.map(
      (keyframe) => {
        const orientation = keyframe.orientation;
        const tooltip = [
          `Yaw ${orientation.yaw_deg.toFixed(1)}°`,
          `Pitch ${orientation.pitch_deg.toFixed(1)}°`,
          `Roll ${orientation.roll_deg.toFixed(1)}°`,
          keyframe.interpolation_to_next,
        ].join(" · ");
        return {
          ariaLabel: `${tooltip} at ${Math.round(keyframe.path_position * 100)}%`,
          id: keyframe.id,
          pathPosition: keyframe.path_position,
          tooltip,
          value: orientation[channel.field],
        };
      },
    );

    return {
      color: channel.color,
      deleteLabel: "Delete camera orientation keyframe",
      deletingKeyframeId,
      domain,
      height: 58,
      id: channel.id,
      keyframes,
      kind: "scalar",
      onDeleteKeyframe,
      renderMarker: () => (
        <span
          className="absolute inset-[5px] rounded-full border-2 bg-card shadow-sm"
          style={{ borderColor: channel.color }}
        />
      ),
      samples: samples.map((sample) => ({
        pathPosition: sample.pathPosition,
        value: sample.orientation[channel.field],
      })),
      summary: `${current[channel.field].toFixed(1)}°`,
      title: channel.title,
    };
  });
}
