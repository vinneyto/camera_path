import type { ReactNode } from "react";
import type { KeyframeTrackDescriptor } from "./timeline-track";
export interface TimelineContribution<T> {
  readonly id: string;
  readonly createTrack?: (inputs: T) => KeyframeTrackDescriptor | null;
  readonly render?: (inputs: T) => ReactNode;
  readonly effect?: {
    readonly label: string;
    readonly available: (inputs: T) => boolean;
    readonly disabled: (inputs: T) => boolean;
    readonly run: (inputs: T) => void;
  };
}
