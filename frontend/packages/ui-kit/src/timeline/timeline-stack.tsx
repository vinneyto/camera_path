"use client";
import type { PointerEvent, ReactNode } from "react";

import type { KeyframeTrackDescriptor } from "@camera-path/types/timeline-track";
import {
  graphLeft,
  TRACK_HORIZONTAL_PADDING,
} from "@camera-path/ui-kit/timeline/graph-layout";
import { KeyLaneTrack } from "@camera-path/ui-kit/timeline/key-lane-track";
import { pathPositionFromClientX } from "@camera-path/ui-kit/timeline/path-position-from-client-x";

interface TimelineStackProps {
  onScrub: (pathPosition: number) => void;
  pathPosition: number;
  tracks?: KeyframeTrackDescriptor[];
  children?: ReactNode;
}

export function TimelineStack({
  onScrub,
  pathPosition,
  tracks = [],
  children,
}: TimelineStackProps) {
  const scrub = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    onScrub(
      pathPositionFromClientX(
        event.clientX,
        bounds.left + TRACK_HORIZONTAL_PADDING,
        bounds.width - TRACK_HORIZONTAL_PADDING * 2,
      ),
    );
  };

  return (
    <div
      aria-label="Trajectory keyframe timelines"
      className="relative outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        onScrub(
          Math.min(
            1,
            Math.max(
              0,
              pathPosition + (event.key === "ArrowLeft" ? -0.01 : 0.01),
            ),
          ),
        );
      }}
      onPointerDown={(event) => {
        if ((event.target as Element).closest("button")) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        scrub(event);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          scrub(event);
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      tabIndex={0}
    >
      {children}
      {tracks.map((track, index) => (
        <div
          className={index < tracks.length - 1 ? "border-b" : undefined}
          key={track.id}
        >
          <KeyLaneTrack track={track} />
        </div>
      ))}
      <span className="pointer-events-none absolute bottom-2 left-2 right-2 top-6 z-20">
        <span
          className="absolute inset-y-0 w-px bg-foreground/55"
          data-timeline-playhead
          style={{ left: graphLeft(pathPosition) }}
        />
      </span>
    </div>
  );
}
