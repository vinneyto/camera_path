"use client";

import { EditorOnly } from "@/features/auth";

import { X } from "lucide-react";

import type { Project } from "@/entities/project";
import type { CompiledTrajectory } from "@/entities/trajectory";
import { Button } from "@/shared/ui";

import { createAimTrack } from "../lib/create-aim-track";
import { createOrientationTrack } from "../lib/create-orientation-track";
import { createDepthOfFieldTrack } from "../lib/create-depth-of-field-track";
import { createLidarTrack } from "../lib/create-lidar-track";
import type { LidarSettings } from "@/shared/api/generated/model";
import { SpeedGraph } from "./speed-graph";
import { TimelineStack } from "./timeline-stack";
import { RenderEffectsControl } from "./render-effects-control";

interface TrajectoryInspectorProps {
  deletingAimKeyframeId?: string;
  deletingOrientationKeyframeId?: string;
  deletingSpeedKeyframeId?: string;
  deletingDepthOfFieldKeyframeId?: string;
  onDeleteAimKeyframe: (keyframeId: string) => void;
  onDeleteOrientationKeyframe: (keyframeId: string) => void;
  onDeleteSpeedKeyframe: (keyframeId: string) => void;
  onDeleteDepthOfFieldKeyframe: (keyframeId: string) => void;
  onScrub: (pathPosition: number) => void;
  pathPosition: number;
  project: Project;
  trajectory: CompiledTrajectory;
  onClose: () => void;
  lidarPending?: boolean;
  lidarError?: string;
  onSetLidar?: (settings: LidarSettings | null) => void;
  effectsPending?: boolean;
  onAddDepthOfField: () => void;
}

export function TrajectoryInspector({
  deletingAimKeyframeId,
  deletingOrientationKeyframeId,
  deletingSpeedKeyframeId,
  deletingDepthOfFieldKeyframeId,
  lidarPending = false,
  lidarError,
  onSetLidar,
  effectsPending,
  onAddDepthOfField,
  onClose,
  onDeleteAimKeyframe,
  onDeleteOrientationKeyframe,
  onDeleteSpeedKeyframe,
  onDeleteDepthOfFieldKeyframe,
  onScrub,
  pathPosition,
  project,
  trajectory,
}: TrajectoryInspectorProps) {
  const keyframeTracks = [
    createAimTrack({
      deletingKeyframeId: deletingAimKeyframeId,
      onDeleteKeyframe: onDeleteAimKeyframe,
      project,
      trajectory,
    }),
    createOrientationTrack({
      deletingKeyframeId: deletingOrientationKeyframeId,
      onDeleteKeyframe: onDeleteOrientationKeyframe,
      trajectory,
    }),
    createDepthOfFieldTrack({
      deletingKeyframeId: deletingDepthOfFieldKeyframeId,
      onDeleteKeyframe: onDeleteDepthOfFieldKeyframe,
      project,
      trajectory,
    }),
  ].filter((track) => track.keyframes.length > 0);

  const lidar = project.camera_track.lidar_keyframe;
  if (lidar)
    keyframeTracks.push(createLidarTrack(lidar, () => onSetLidar?.(null)));

  return (
    <section className="border-t bg-muted/35 p-2">
      <div className="mb-1.5 flex items-center justify-between px-0.5">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold">Trajectory controls</h2>
          <span className="text-[10px] text-muted-foreground">
            {trajectory.total_length.toFixed(2)} m
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <EditorOnly>
            <RenderEffectsControl
              disabled={effectsPending}
              hasDepthOfField={
                trajectory.camera_track.depth_of_field_keyframes.length > 0
              }
              onAddDepthOfField={onAddDepthOfField}
              hasLidar={Boolean(lidar)}
              onAddLidar={onSetLidar ? () => onSetLidar({}) : undefined}
              lidarPending={lidarPending}
            />
          </EditorOnly>
          <Button
            aria-label="Close trajectory panels"
            onClick={onClose}
            size="icon"
            variant="ghost"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>
      <div className="overflow-hidden rounded-md border bg-card">
        <SpeedGraph
          deletingKeyframeId={deletingSpeedKeyframeId}
          onDeleteKeyframe={onDeleteSpeedKeyframe}
          pathPosition={pathPosition}
          trajectory={trajectory}
        />
        {keyframeTracks.length > 0 && (
          <TimelineStack
            onScrub={onScrub}
            pathPosition={pathPosition}
            tracks={keyframeTracks}
          />
        )}
      </div>
      {lidarError && (
        <p role="alert" className="text-xs text-destructive">
          {lidarError}
        </p>
      )}
    </section>
  );
}
