import { useMemo } from "react";

import { evaluateSpeed, type CompiledTrajectory } from "@/entities/trajectory";

interface SpeedGraphProps {
  pathPosition: number;
  trajectory: CompiledTrajectory;
}

export function SpeedGraph({ pathPosition, trajectory }: SpeedGraphProps) {
  const samples = useMemo(
    () => Array.from({ length: 81 }, (_, index) => ({
      position: index / 80,
      speed: evaluateSpeed(trajectory, index / 80),
    })),
    [trajectory],
  );
  const maximum = Math.max(1, ...samples.map((sample) => sample.speed));
  const points = samples
    .map((sample) => `${24 + sample.position * 352},${74 - (sample.speed / maximum) * 58}`)
    .join(" ");

  return (
    <div className="min-h-0 rounded-md border bg-card p-2">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Speed over path</h3>
        <span className="font-mono text-[10px]">{evaluateSpeed(trajectory, pathPosition).toFixed(2)} m/s</span>
      </div>
      <svg aria-label="Camera speed graph" className="h-[82px] w-full" preserveAspectRatio="none" viewBox="0 0 400 82">
        <path d="M24 8V74H388" fill="none" stroke="currentColor" strokeOpacity="0.18" />
        <line stroke="currentColor" strokeDasharray="3 3" strokeOpacity="0.12" x1="24" x2="388" y1="45" y2="45" />
        <polyline fill="none" points={points} stroke="#f97316" strokeLinejoin="round" strokeWidth="2" />
        <line stroke="#171717" strokeOpacity="0.6" x1={24 + pathPosition * 352} x2={24 + pathPosition * 352} y1="8" y2="74" />
        {trajectory.motion_profile.keyframes.map((key) => (
          <circle cx={24 + key.path_position * 352} cy={74 - (key.speed / maximum) * 58} fill="#f97316" key={key.id} r="3" />
        ))}
        <text fill="currentColor" fontSize="8" opacity="0.45" x="24" y="81">0</text>
        <text fill="currentColor" fontSize="8" opacity="0.45" textAnchor="end" x="388" y="81">100%</text>
      </svg>
    </div>
  );
}
