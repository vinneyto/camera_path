import type { Project } from "@/entities/project";
import { getAimLabel, type CompiledTrajectory } from "@/entities/trajectory";

import type { KeyframeTrackDescriptor } from "../model/timeline-track";
import { AimKeyframeMarker } from "../ui/aim-keyframe-marker";

interface CreateAimTrackOptions {
  deletingKeyframeId?: string;
  onDeleteKeyframe: (keyframeId: string) => void;
  project: Project;
  trajectory: CompiledTrajectory;
}

export function createAimTrack({
  deletingKeyframeId,
  onDeleteKeyframe,
  project,
  trajectory,
}: CreateAimTrackOptions): KeyframeTrackDescriptor {
  const keyframes = trajectory.camera_track.keyframes.map((keyframe) => {
    const label = getAimLabel(keyframe.aim, project);
    return {
      ariaLabel: `${label} at ${Math.round(keyframe.path_position * 100)}%`,
      id: keyframe.id,
      pathPosition: keyframe.path_position,
      tooltip: label,
    };
  });

  return {
    color: "var(--chart-aim)",
    deleteLabel: "Delete camera aim keyframe",
    deletingKeyframeId,
    emptyState:
      keyframes.length === 0
        ? `${getAimLabel(trajectory.camera_track.default_aim, project)} across the whole trajectory`
        : null,
    height: 24,
    id: "camera-aim",
    keyframes,
    lineY: 10,
    onDeleteKeyframe,
    renderMarker: () => <AimKeyframeMarker />,
    summary: keyframes.length
      ? `${keyframes.length} key${keyframes.length === 1 ? "" : "s"}`
      : "Default only",
    title: "Camera aim",
  };
}
