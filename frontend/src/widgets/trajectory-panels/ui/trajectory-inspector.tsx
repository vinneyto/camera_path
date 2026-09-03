import { X } from "lucide-react";

import type { Project } from "@/entities/project";
import type { CompiledTrajectory } from "@/entities/trajectory";
import { Button } from "@/shared/ui";

import { AimGraph } from "./aim-graph";
import { SpeedGraph } from "./speed-graph";

interface TrajectoryInspectorProps {
  deletingAimKeyframeId?: string;
  deletingSpeedKeyframeId?: string;
  onDeleteAimKeyframe: (keyframeId: string) => void;
  onDeleteSpeedKeyframe: (keyframeId: string) => void;
  pathPosition: number;
  project: Project;
  trajectory: CompiledTrajectory;
  onClose: () => void;
}

export function TrajectoryInspector({
  deletingAimKeyframeId,
  deletingSpeedKeyframeId,
  onClose,
  onDeleteAimKeyframe,
  onDeleteSpeedKeyframe,
  pathPosition,
  project,
  trajectory,
}: TrajectoryInspectorProps) {
  return (
    <section className="border-t bg-muted/35 p-2">
      <div className="mb-1.5 flex items-center justify-between px-0.5">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold">Trajectory controls</h2>
          <span className="text-[10px] text-muted-foreground">{trajectory.total_length.toFixed(2)} m</span>
        </div>
        <Button aria-label="Close trajectory panels" onClick={onClose} size="icon" variant="ghost">
          <X className="size-3.5" />
        </Button>
      </div>
      <div className="overflow-hidden rounded-md border bg-card">
        <SpeedGraph
          deletingKeyframeId={deletingSpeedKeyframeId}
          onDeleteKeyframe={onDeleteSpeedKeyframe}
          pathPosition={pathPosition}
          trajectory={trajectory}
        />
        <AimGraph
          deletingKeyframeId={deletingAimKeyframeId}
          onDeleteKeyframe={onDeleteAimKeyframe}
          pathPosition={pathPosition}
          project={project}
          trajectory={trajectory}
        />
      </div>
    </section>
  );
}
