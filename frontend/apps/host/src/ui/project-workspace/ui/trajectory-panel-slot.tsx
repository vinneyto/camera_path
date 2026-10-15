"use client";
import { CameraAimTimeline } from "@camera-path/feature-camera-aim";
import { CameraOrientationTimeline } from "@camera-path/feature-camera-orientation";
import {
  DepthOfFieldEffect,
  DepthOfFieldTimeline,
} from "@camera-path/feature-depth-of-field";
import { LidarEffect, LidarTimeline } from "@camera-path/feature-lidar";
import { PlaybackControls } from "@camera-path/feature-playback";
import { SpeedTimeline } from "@camera-path/feature-speed-track";

import { useEditorActions, useSeekPlayback } from "@camera-path/actions";
import { useCompiledTrajectoryResource } from "@camera-path/api/resources";
import { usePlaybackState, useSceneInteraction } from "@camera-path/store";

import { trajectoryObjectId } from "@camera-path/types/trajectory-object-id";
import { Button } from "@camera-path/ui-kit";
import { TimelineStack } from "@camera-path/ui-kit/timeline/timeline-stack";
import { Plus, X } from "lucide-react";
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
      <PlaybackControls />
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
              <details className="group relative hidden has-[button]:block">
                <summary className="flex h-6 cursor-pointer list-none items-center gap-1 rounded border bg-background px-1.5 text-[10px] text-muted-foreground hover:bg-accent">
                  <Plus className="size-3" />
                  Add effect
                </summary>
                <div className="absolute right-0 top-full z-20 mt-1 min-w-32 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                  <DepthOfFieldEffect />
                  <LidarEffect />
                </div>
              </details>
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
              <SpeedTimeline />
              <CameraAimTimeline />
              <CameraOrientationTimeline />
              <DepthOfFieldTimeline />
              <LidarTimeline />
            </TimelineStack>
          </div>
        </section>
      )}
    </div>
  );
}
