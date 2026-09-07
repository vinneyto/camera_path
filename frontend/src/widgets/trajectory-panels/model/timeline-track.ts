import type { ReactNode } from "react";

export interface TimelineKeyframe {
  ariaLabel: string;
  id: string;
  pathPosition: number;
  tooltip: string;
}

interface TimelineTrackBase {
  deleteLabel: string;
  deletingKeyframeId?: string;
  height: number;
  id: string;
  onDeleteKeyframe: (keyframeId: string) => void;
  renderMarker: () => ReactNode;
  summary: string;
  title: string;
}

export interface ScalarTimelineKeyframe extends TimelineKeyframe {
  value: number;
}

export interface ScalarTrackDescriptor extends TimelineTrackBase {
  color: string;
  domain: readonly [number, number];
  keyframes: ScalarTimelineKeyframe[];
  kind: "scalar";
  samples: Array<{ pathPosition: number; value: number }>;
  yAxisLabel: string;
}

export interface KeyLaneTrackDescriptor extends TimelineTrackBase {
  color: string;
  emptyState: string | null;
  keyframes: TimelineKeyframe[];
  kind: "key-lane";
  lineY: number;
}

export type TimelineTrackDescriptor = ScalarTrackDescriptor | KeyLaneTrackDescriptor;
