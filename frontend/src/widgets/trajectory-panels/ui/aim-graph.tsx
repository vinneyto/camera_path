import type { Project } from "@/entities/project/model/types";
import { getAimLabel } from "@/entities/trajectory/lib/get-aim-label";
import type { CompiledTrajectory } from "@/entities/trajectory/model/types";

interface AimGraphProps {
  pathPosition: number;
  project: Project;
  trajectory: CompiledTrajectory;
}

export function AimGraph({ pathPosition, project, trajectory }: AimGraphProps) {
  const keys = trajectory.camera_track.keyframes;
  return (
    <div className="min-h-0 rounded-md border bg-card p-2">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Camera aim keys</h3>
        <span className="text-[10px] text-muted-foreground">{keys.length || "Default only"}</span>
      </div>
      <div className="relative h-[82px] overflow-hidden">
        <div className="absolute left-6 right-3 top-8 h-px bg-border" />
        <div className="absolute bottom-3 left-6 right-3 flex justify-between text-[8px] text-muted-foreground">
          <span>0</span><span>path position</span><span>100%</span>
        </div>
        <div className="absolute bottom-3 top-1 w-px bg-foreground/60" style={{ left: `${6 + pathPosition * 91}%` }} />
        {keys.map((key) => (
          <div
            className="absolute top-[22px] -translate-x-1/2"
            key={key.id}
            style={{ left: `${6 + key.path_position * 91}%` }}
          >
            <div className="size-3 rounded-full border-2 border-background bg-violet-500 shadow-sm" />
            <div className="mt-1 max-w-20 -translate-x-[calc(50%-6px)] truncate text-[8px] font-medium">
              {getAimLabel(key.aim, project)}
            </div>
          </div>
        ))}
        {keys.length === 0 && (
          <p className="absolute left-6 top-11 text-[9px] text-muted-foreground">
            {getAimLabel(trajectory.camera_track.default_aim, project)} across the whole trajectory
          </p>
        )}
      </div>
    </div>
  );
}
