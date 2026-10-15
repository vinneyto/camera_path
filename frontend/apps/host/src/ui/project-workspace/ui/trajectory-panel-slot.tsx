"use client";
import { Slot } from "@camera-path/slots";

import { useEditorActions, useSeekPlayback } from "@camera-path/actions";
import { useCompiledTrajectoryResource } from "@camera-path/api/resources";
import { usePlaybackState, useSceneInteraction } from "@camera-path/store";

import { trajectoryObjectId } from "@camera-path/types/trajectory-object-id";
import { Button } from "@camera-path/ui-kit";
import { TimelineStack } from "@camera-path/ui-kit/timeline/timeline-stack";
import { X } from "lucide-react";
export function TrajectoryPanelSlot() {
  const query = useCompiledTrajectoryResource();
  const playback = usePlaybackState();
  const selected =
    useSceneInteraction().selectedObjectId === trajectoryObjectId;
  const select = useEditorActions().selectObject;
  const seek = useSeekPlayback();
  const trajectory = query.data?.data;
  if (!trajectory?.position_segments.length) return null;
  return (
    <div className="overflow-hidden rounded-lg border bg-background/90 shadow-lg backdrop-blur-md">
      <Slot name="timeline.controls" />
      {selected && (
        <section className="border-t bg-muted/35 p-2">
          <div className="mb-1.5 flex items-center justify-between px-0.5">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold">Trajectory controls</h2>
              <span className="text-[10px] text-muted-foreground">
                {trajectory.total_length.toFixed(2)} m
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                aria-label="Close trajectory panels"
                onClick={() =>
                  void select({ id: null, ifCurrentId: trajectoryObjectId })
                }
                size="icon"
                variant="ghost"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-md border bg-card">
            <TimelineStack
              pathPosition={playback.pathPosition}
              onScrub={(position) => void seek(position)}
            >
              <Slot name="timeline.tracks" />
            </TimelineStack>
          </div>
        </section>
      )}
    </div>
  );
}
