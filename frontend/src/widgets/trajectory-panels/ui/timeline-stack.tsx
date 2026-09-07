"use client";

import type { PointerEvent } from "react";

import { graphLeft, TRACK_HORIZONTAL_PADDING } from "../lib/graph-layout";
import { pathPositionFromClientX } from "../lib/path-position-from-client-x";
import type { KeyframeTrackDescriptor } from "../model/timeline-track";
import { KeyLaneTrack } from "./key-lane-track";

interface TimelineStackProps {
  onScrub: (pathPosition: number) => void;
  pathPosition: number;
  tracks: KeyframeTrackDescriptor[];
}

export function TimelineStack({ onScrub, pathPosition, tracks }: TimelineStackProps) {
  const scrub = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    onScrub(pathPositionFromClientX(
      event.clientX,
      bounds.left + TRACK_HORIZONTAL_PADDING,
      bounds.width - TRACK_HORIZONTAL_PADDING * 2,
    ));
  };

  return (
    <div
      aria-label="Trajectory keyframe timelines"
      className="relative outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        onScrub(Math.min(1, Math.max(0, pathPosition + (event.key === "ArrowLeft" ? -0.01 : 0.01))));
      }}
      onPointerDown={(event) => {
        if ((event.target as Element).closest("button")) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        scrub(event);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) scrub(event);
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      tabIndex={0}
    >
      {tracks.map((track, index) => (
        <div className={index < tracks.length - 1 ? "border-b" : undefined} key={track.id}>
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
