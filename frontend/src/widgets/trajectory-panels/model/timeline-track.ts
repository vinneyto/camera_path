import type { ReactNode } from "react";

export interface TimelineKeyframe {
  ariaLabel: string;
  id: string;
  pathPosition: number;
  tooltip: string;
}

export interface KeyframeTrackDescriptor {
  kind: "key";
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

export interface ScalarTimelineKeyframe extends TimelineKeyframe {
  value: number;
}

export interface ScalarTrackDescriptor {
  color: string;
  deleteLabel: string;
  deletingKeyframeId?: string;
  domain: readonly [number, number];
  height: number;
  id: string;
  keyframes: ScalarTimelineKeyframe[];
  kind: "scalar";
  onDeleteKeyframe: (keyframeId: string) => void;
  renderMarker: () => ReactNode;
  samples: Array<{ pathPosition: number; value: number }>;
  summary: string;
  title: string;
}

export type TimelineTrackDescriptor =
  KeyframeTrackDescriptor | ScalarTrackDescriptor;
