"use client";
import type { TimelineInputs } from "@host/composition/timeline-inputs";
import { timelineContributions } from "@host/composition/timelines";

import { EditorOnly } from "@host/ui/header";

import { X } from "lucide-react";

import type { Project } from "@camera-path/contracts/project";
import type { CompiledTrajectory } from "@camera-path/trajectory-math";
import { Button } from "@camera-path/ui-kit";

import type { LidarSettings } from "@camera-path/contracts/api";
import { TimelineStack } from "@camera-path/ui-kit/timeline/timeline-stack";
import { RenderEffectsControl } from "@host/ui/trajectory-panels/ui/render-effects-control";

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
  const inputs: TimelineInputs = {
    project,
    trajectory,
    pathPosition,
    onScrub,
    deletingAimKeyframeId,
    deletingOrientationKeyframeId,
    deletingSpeedKeyframeId,
    deletingDepthOfFieldKeyframeId,
    onDeleteAimKeyframe,
    onDeleteOrientationKeyframe,
    onDeleteSpeedKeyframe,
    onDeleteDepthOfFieldKeyframe,
    onSetLidar,
    effectsPending,
    lidarPending,
    onAddDepthOfField,
  };
  const keyframeTracks = timelineContributions.flatMap((c) => {
    const track = c.createTrack?.(inputs);
    return track ? [track] : [];
  });
  const effects = timelineContributions.flatMap((c) =>
    c.effect?.available(inputs)
      ? [
          {
            id: c.id,
            label: c.effect.label,
            disabled: c.effect.disabled(inputs),
            run: () => c.effect!.run(inputs),
          },
        ]
      : [],
  );

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
            <RenderEffectsControl effects={effects} />
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
        {timelineContributions.map((c) => (
          <div key={c.id}>{c.render?.(inputs)}</div>
        ))}
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
