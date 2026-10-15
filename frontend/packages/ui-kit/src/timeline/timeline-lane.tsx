"use client";
import type { KeyframeTrackDescriptor } from "@camera-path/types/timeline-track";
import { KeyLaneTrack } from "./key-lane-track";
export function TimelineLane({
  track,
  error,
}: {
  track: KeyframeTrackDescriptor | null;
  error?: Error | null;
}) {
  return (
    <>
      {track && (
        <div className="border-b last:border-b-0">
          <KeyLaneTrack track={track} />
        </div>
      )}
      {error && (
        <p role="alert" className="px-2 text-xs text-destructive">
          {error.message}
        </p>
      )}
    </>
  );
}
