import type { Project } from "@/entities/project";
import type { CompiledTrajectory } from "@/entities/trajectory";

import type { KeyframeTrackDescriptor } from "../model/timeline-track";

interface CreateDepthOfFieldTrackOptions {
  deletingKeyframeId?: string;
  onDeleteKeyframe: (keyframeId: string) => void;
  project: Project;
  trajectory: CompiledTrajectory;
}

export function createDepthOfFieldTrack({
  deletingKeyframeId,
  onDeleteKeyframe,
  project,
  trajectory,
}: CreateDepthOfFieldTrackOptions): KeyframeTrackDescriptor {
  const keyframes = trajectory.camera_track.depth_of_field_keyframes.map(
    (keyframe) => {
      const label =
        keyframe.focus.kind === "center_weighted_9"
          ? "Nine-point autofocus"
          : `Focus on ${
              project.scene_points[keyframe.focus.scene_point_id]?.label ??
              "scene point"
            }`;
      return {
        ariaLabel: `${label} at ${Math.round(keyframe.path_position * 100)}%`,
        id: keyframe.id,
        pathPosition: keyframe.path_position,
        tooltip: label,
      };
    },
  );

  return {
    color: "var(--chart-dof)",
    deleteLabel: "Delete depth of field keyframe",
    deletingKeyframeId,
    emptyState: null,
    height: 24,
    id: "depth-of-field",
    keyframes,
    lineY: 10,
    onDeleteKeyframe,
    renderMarker: () => (
      <span className="absolute inset-[4px] rounded-full border-2 border-[var(--chart-dof)] bg-card shadow-sm" />
    ),
    summary: `${keyframes.length} key${keyframes.length === 1 ? "" : "s"}`,
    title: "Depth of field",
  };
}
