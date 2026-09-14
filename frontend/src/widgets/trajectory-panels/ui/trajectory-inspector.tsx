"use client";

import { X } from "lucide-react";

import type { DepthOfFieldEffect, Project } from "@/entities/project";
import type { CompiledTrajectory } from "@/entities/trajectory";
import { Button } from "@/shared/ui";

import { createAimTrack } from "../lib/create-aim-track";
import { createOrientationTrack } from "../lib/create-orientation-track";
import { SpeedGraph } from "./speed-graph";
import { TimelineStack } from "./timeline-stack";
import { RenderEffectsControl } from "./render-effects-control";

interface TrajectoryInspectorProps {
  deletingAimKeyframeId?: string;
  deletingOrientationKeyframeId?: string;
  deletingSpeedKeyframeId?: string;
  onDeleteAimKeyframe: (keyframeId: string) => void;
  onDeleteOrientationKeyframe: (keyframeId: string) => void;
  onDeleteSpeedKeyframe: (keyframeId: string) => void;
  onScrub: (pathPosition: number) => void;
  pathPosition: number;
  project: Project;
  trajectory: CompiledTrajectory;
  onClose: () => void;
  depthOfField: DepthOfFieldEffect | null;
  effectsPending?: boolean;
  onAddDepthOfField: () => void;
  onRemoveDepthOfField: () => void;
}

export function TrajectoryInspector({
  deletingAimKeyframeId,
  deletingOrientationKeyframeId,
  deletingSpeedKeyframeId,
  depthOfField,
  effectsPending,
  onAddDepthOfField,
  onClose,
  onDeleteAimKeyframe,
  onDeleteOrientationKeyframe,
  onDeleteSpeedKeyframe,
  onRemoveDepthOfField,
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
  ];

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
          <RenderEffectsControl
            depthOfField={depthOfField}
            disabled={effectsPending}
            onAddDepthOfField={onAddDepthOfField}
            onRemoveDepthOfField={onRemoveDepthOfField}
          />
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
        <TimelineStack
          onScrub={onScrub}
          pathPosition={pathPosition}
          tracks={keyframeTracks}
        />
      </div>
    </section>
  );
}
