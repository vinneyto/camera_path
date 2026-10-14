"use client";
import type { LidarKeyframe } from "@camera-path/contracts/api";
import type { KeyframeTrackDescriptor } from "@camera-path/contracts/timeline-track";

export function createLidarTrack(
  keyframe: LidarKeyframe,
  onDelete: () => void,
): KeyframeTrackDescriptor {
  return {
    id: "lidar",
    title: "LiDAR",
    color: "var(--chart-lidar)",
    height: 24,
    lineY: 10,
    deleteLabel: "Remove LiDAR",
    emptyState: null,
    onDeleteKeyframe: onDelete,
    summary: `${keyframe.horizontal_resolution} × ${keyframe.vertical_resolution} rays · ${keyframe.vertical_fov_deg}° vertical`,
    keyframes: [
      {
        id: keyframe.id!,
        pathPosition: 0,
        ariaLabel: "LiDAR present from start",
        tooltip: "LiDAR present for the whole trajectory",
      },
    ],
    renderMarker: () => (
      <span className="absolute inset-[4px] rounded-sm border-2 border-[var(--chart-lidar)] bg-card" />
    ),
  };
}
