import { X } from "lucide-react";

import type { Project } from "@/entities/project/model/types";
import type { CompiledTrajectory } from "@/entities/trajectory/model/types";
import { Button } from "@/shared/ui/button";
import { AimGraph } from "@/widgets/trajectory-panels/ui/aim-graph";
import { SpeedGraph } from "@/widgets/trajectory-panels/ui/speed-graph";

interface TrajectoryInspectorProps {
  pathPosition: number;
  project: Project;
  trajectory: CompiledTrajectory;
  onClose: () => void;
}

export function TrajectoryInspector({ pathPosition, project, trajectory, onClose }: TrajectoryInspectorProps) {
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
      <div className="grid grid-rows-2 gap-2">
        <SpeedGraph pathPosition={pathPosition} trajectory={trajectory} />
        <AimGraph pathPosition={pathPosition} project={project} trajectory={trajectory} />
      </div>
    </section>
  );
}
