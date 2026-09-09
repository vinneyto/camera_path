import type { ReactNode } from "react";

export interface TimelineKeyframe {
  ariaLabel: string;
  id: string;
  pathPosition: number;
  tooltip: string;
}

export interface KeyframeTrackDescriptor {
  color: string;
  deleteLabel: string;
  deletingKeyframeId?: string;
  height: number;
  id: string;
  keyframes: TimelineKeyframe[];
  lineY: number;
  onDeleteKeyframe: (keyframeId: string) => void;
  renderMarker: () => ReactNode;
  summary: string;
  title: string;
}
