import { evaluateSpeed, type CompiledTrajectory } from "@/entities/trajectory";

import type { ScalarTrackDescriptor } from "../model/timeline-track";
import { SpeedKeyframeMarker } from "../ui/speed-keyframe-marker";

interface CreateSpeedTrackOptions {
  deletingKeyframeId?: string;
  onDeleteKeyframe: (keyframeId: string) => void;
  pathPosition: number;
  trajectory: CompiledTrajectory;
}

export function createSpeedTrack({
  deletingKeyframeId,
  onDeleteKeyframe,
  pathPosition,
  trajectory,
}: CreateSpeedTrackOptions): ScalarTrackDescriptor {
  const samples = Array.from({ length: 101 }, (_, index) => ({
    pathPosition: index / 100,
    value: evaluateSpeed(trajectory, index / 100),
  }));
  const maximum = Math.max(
    2,
    Math.ceil(Math.max(...samples.map((sample) => sample.value)) * 2) / 2,
  );

  return {
    color: "var(--chart-speed)",
    deleteLabel: "Delete speed keyframe",
    deletingKeyframeId,
    domain: [0, maximum],
    height: 92,
    id: "speed",
    keyframes: trajectory.motion_profile.keyframes.map((keyframe) => ({
      ariaLabel: `Speed ${keyframe.speed.toFixed(2)} m/s at ${Math.round(keyframe.path_position * 100)}%`,
      id: keyframe.id,
      pathPosition: keyframe.path_position,
      tooltip: `Speed: ${keyframe.speed.toFixed(2)} m/s`,
      value: keyframe.speed,
    })),
    kind: "scalar",
    onDeleteKeyframe,
    renderMarker: () => <SpeedKeyframeMarker />,
    samples,
    summary: `${evaluateSpeed(trajectory, pathPosition).toFixed(2)} m/s`,
    title: "Speed over path",
    yAxisLabel: "Speed, m/s",
  };
}
