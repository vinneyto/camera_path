"use client";

import { useState } from "react";

import type { Project } from "@/entities/project";
import { getAimLabel, type CompiledTrajectory } from "@/entities/trajectory";
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

interface AimGraphProps {
  deletingKeyframeId?: string;
  onDeleteKeyframe: (keyframeId: string) => void;
  pathPosition: number;
  project: Project;
  trajectory: CompiledTrajectory;
}

interface AimMenuState extends ContextMenuPosition {
  keyframeId: string;
}

export function AimGraph({
  deletingKeyframeId,
  onDeleteKeyframe,
  pathPosition,
  project,
  trajectory,
}: AimGraphProps) {
  const [hoveredKeyframeId, setHoveredKeyframeId] = useState<string | null>(null);
  const [menu, setMenu] = useState<AimMenuState | null>(null);
  const keys = trajectory.camera_track.keyframes;
  const lineY = 38;

  return (
    <div className="min-h-0 p-2 pt-1.5">
      <div className="mb-0.5 flex items-center justify-between">
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Camera aim keys</h3>
        <span className="text-[10px] text-muted-foreground">{keys.length ? `${keys.length} keys` : "Default only"}</span>
      </div>
      <div className="relative h-[92px] w-full">
        <svg
          aria-label="Camera aim keyframes"
          className="absolute inset-0 h-full w-full overflow-visible"
          preserveAspectRatio="none"
          viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
        >
          <line stroke="var(--chart-aim)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={lineY} y2={lineY} />
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
        <span className="absolute top-[49px] -translate-x-1/2 text-[8px] text-muted-foreground" style={{ left: graphLeft(0) }}>0</span>
        <span className="absolute top-[49px] -translate-x-1/2 text-[8px] text-muted-foreground" style={{ left: graphLeft(1) }}>1</span>
        {keys.map((keyframe) => {
          const hovered = hoveredKeyframeId === keyframe.id;
          return (
            <button
              aria-label={`${getAimLabel(keyframe.aim, project)} at ${Math.round(keyframe.path_position * 100)}%`}
              className="group absolute z-10 size-5 -translate-x-1/2 -translate-y-1/2 rounded-sm outline-none"
              key={keyframe.id}
              onBlur={() => setHoveredKeyframeId(null)}
              onContextMenu={(event) => {
                event.preventDefault();
                setMenu({ keyframeId: keyframe.id, x: event.clientX, y: event.clientY });
              }}
              onFocus={() => setHoveredKeyframeId(keyframe.id)}
              onMouseEnter={() => setHoveredKeyframeId(keyframe.id)}
              onMouseLeave={() => setHoveredKeyframeId(null)}
              style={{ left: graphLeft(keyframe.path_position), top: lineY }}
              type="button"
            >
              <span className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] border-2 border-[var(--chart-aim)] bg-card shadow-sm transition-shadow group-focus-visible:ring-4 group-focus-visible:ring-[color-mix(in_oklab,var(--chart-aim)_25%,transparent)] group-hover:ring-4 group-hover:ring-[color-mix(in_oklab,var(--chart-aim)_25%,transparent)]" />
              {hovered && (
                <span className="pointer-events-none absolute bottom-[calc(100%+4px)] left-1/2 z-20 w-max max-w-48 -translate-x-1/2 rounded-md border bg-popover px-2 py-1 text-[9px] font-semibold text-popover-foreground shadow-lg">
                  {getAimLabel(keyframe.aim, project)}
                </span>
              )}
            </button>
          );
        })}
        {keys.length === 0 && (
          <p className="absolute text-[9px] text-muted-foreground" style={{ left: graphLeft(0), top: 63 }}>
            {getAimLabel(trajectory.camera_track.default_aim, project)} across the whole trajectory
          </p>
        )}
      </div>
      <ContextMenu
        items={menu ? [{
          destructive: true,
          disabled: deletingKeyframeId === menu.keyframeId,
          label: "Delete camera aim keyframe",
          onSelect: () => onDeleteKeyframe(menu.keyframeId),
        }] : []}
        onClose={() => setMenu(null)}
        position={menu}
      />
    </div>
  );
}
