"use client";

import { useMemo, useState } from "react";

import { evaluateSpeed, type CompiledTrajectory } from "@/entities/trajectory";
import { ContextMenu, type ContextMenuPosition } from "@/shared/ui";

import {
  GRAPH_HEIGHT,
  GRAPH_WIDTH,
  graphLeft,
  graphX,
  PLOT_BOTTOM,
  PLOT_LEFT,
  PLOT_RIGHT,
  PLOT_TOP,
} from "../lib/graph-layout";

interface SpeedGraphProps {
  deletingKeyframeId?: string;
  onDeleteKeyframe: (keyframeId: string) => void;
  pathPosition: number;
  trajectory: CompiledTrajectory;
}

interface SpeedMenuState extends ContextMenuPosition {
  keyframeId: string;
}

export function SpeedGraph({
  deletingKeyframeId,
  onDeleteKeyframe,
  pathPosition,
  trajectory,
}: SpeedGraphProps) {
  const [hoveredKeyframeId, setHoveredKeyframeId] = useState<string | null>(null);
  const [menu, setMenu] = useState<SpeedMenuState | null>(null);
  const samples = useMemo(
    () => Array.from({ length: 101 }, (_, index) => ({
      position: index / 100,
      speed: evaluateSpeed(trajectory, index / 100),
    })),
    [trajectory],
  );
  const maximum = Math.max(2, Math.ceil(Math.max(...samples.map((sample) => sample.speed)) * 2) / 2);
  const speedY = (speed: number) => PLOT_BOTTOM - (speed / maximum) * (PLOT_BOTTOM - PLOT_TOP);
  const points = samples.map((sample) => `${graphX(sample.position)},${speedY(sample.speed)}`).join(" ");
  const middleY = (PLOT_TOP + PLOT_BOTTOM) / 2;

  return (
    <div className="min-h-0 border-b p-2 pb-1">
      <div className="mb-0.5 flex items-center justify-between">
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Speed over path</h3>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
          {evaluateSpeed(trajectory, pathPosition).toFixed(2)} m/s
        </span>
      </div>
      <div className="relative h-[92px] w-full">
        <svg
          aria-label="Camera speed graph"
          className="absolute inset-0 h-full w-full overflow-visible"
          preserveAspectRatio="none"
          viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
        >
          {[PLOT_TOP, middleY, PLOT_BOTTOM].map((y) => (
            <line key={y} stroke="var(--chart-grid)" vectorEffect="non-scaling-stroke" x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={y} y2={y} />
          ))}
          <line stroke="var(--chart-grid)" vectorEffect="non-scaling-stroke" x1={PLOT_LEFT} x2={PLOT_LEFT} y1={PLOT_TOP} y2={PLOT_BOTTOM} />
          <polyline
            fill="none"
            points={points}
            stroke="var(--chart-speed)"
            strokeLinejoin="round"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
          <line
            stroke="currentColor"
            strokeOpacity="0.55"
            vectorEffect="non-scaling-stroke"
            x1={graphX(pathPosition)}
            x2={graphX(pathPosition)}
            y1={PLOT_TOP - 2}
            y2={PLOT_BOTTOM + 6}
          />
        </svg>
        <span className="absolute left-0 top-[31px] text-[7px] text-muted-foreground">Speed, m/s</span>
        {[
          { label: maximum.toFixed(1), y: PLOT_TOP },
          { label: (maximum / 2).toFixed(1), y: middleY },
          { label: "0.0", y: PLOT_BOTTOM },
        ].map(({ label, y }) => (
          <span
            className="absolute -translate-y-1/2 text-right text-[7px] tabular-nums text-muted-foreground"
            key={label}
            style={{ left: "7.2%", top: y, width: "3.2%" }}
          >
            {label}
          </span>
        ))}
        {trajectory.motion_profile.keyframes.map((keyframe) => {
          const hovered = hoveredKeyframeId === keyframe.id;
          return (
            <button
              aria-label={`Speed ${keyframe.speed.toFixed(2)} m/s at ${Math.round(keyframe.path_position * 100)}%`}
              className="group absolute z-10 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full outline-none"
              key={keyframe.id}
              onBlur={() => setHoveredKeyframeId(null)}
              onContextMenu={(event) => {
                event.preventDefault();
                setMenu({ keyframeId: keyframe.id, x: event.clientX, y: event.clientY });
              }}
              onFocus={() => setHoveredKeyframeId(keyframe.id)}
              onMouseEnter={() => setHoveredKeyframeId(keyframe.id)}
              onMouseLeave={() => setHoveredKeyframeId(null)}
              style={{ left: graphLeft(keyframe.path_position), top: speedY(keyframe.speed) }}
              type="button"
            >
              <span className="absolute inset-0 rounded-full border-2 border-[var(--chart-speed)] opacity-0 transition-opacity group-focus-visible:opacity-30 group-hover:opacity-30" />
              <span className="absolute inset-[5px] rounded-full border-2 border-[var(--chart-speed)] bg-card shadow-sm" />
              {hovered && (
                <span className="pointer-events-none absolute bottom-[calc(100%+4px)] left-1/2 z-20 w-max -translate-x-1/2 rounded-md border bg-popover px-2 py-1 text-[9px] font-semibold text-popover-foreground shadow-lg">
                  Speed: {keyframe.speed.toFixed(2)} m/s
                </span>
              )}
            </button>
          );
        })}
      </div>
      <ContextMenu
        items={menu ? [{
          destructive: true,
          disabled: deletingKeyframeId === menu.keyframeId,
          label: "Delete speed keyframe",
          onSelect: () => onDeleteKeyframe(menu.keyframeId),
        }] : []}
        onClose={() => setMenu(null)}
        position={menu}
      />
    </div>
  );
}
