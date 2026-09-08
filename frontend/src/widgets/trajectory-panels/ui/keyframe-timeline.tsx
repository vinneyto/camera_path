"use client";

import { type ReactNode, useState } from "react";

import { ContextMenu, type ContextMenuPosition } from "@/shared/ui";

import { graphLeft } from "../lib/graph-layout";
import type { TimelineKeyframe } from "../model/timeline-track";

interface PositionedTimelineKeyframe extends TimelineKeyframe {
  top: number;
}

interface KeyframeTimelineProps {
  deleteLabel: string;
  deletingKeyframeId?: string;
  keyframes: PositionedTimelineKeyframe[];
  onDeleteKeyframe: (keyframeId: string) => void;
  renderMarker: () => ReactNode;
}

interface KeyframeMenuState extends ContextMenuPosition {
  keyframeId: string;
}

export function KeyframeTimeline({
  deleteLabel,
  deletingKeyframeId,
  keyframes,
  onDeleteKeyframe,
  renderMarker,
}: KeyframeTimelineProps) {
  const [menu, setMenu] = useState<KeyframeMenuState | null>(null);
  const [selectedKeyframeId, setSelectedKeyframeId] = useState<string | null>(null);

  return (
    <>
      {keyframes.map((keyframe) => (
        <button
          aria-label={keyframe.ariaLabel}
          aria-pressed={selectedKeyframeId === keyframe.id}
          className="group absolute z-30 size-5 -translate-x-1/2 -translate-y-1/2 rounded-sm outline-none aria-pressed:ring-2 aria-pressed:ring-ring"
          data-keyframe-id={keyframe.id}
          key={keyframe.id}
          onContextMenu={(event) => {
            event.preventDefault();
            setSelectedKeyframeId(keyframe.id);
            setMenu({ keyframeId: keyframe.id, x: event.clientX, y: event.clientY });
          }}
          onClick={() => setSelectedKeyframeId(keyframe.id)}
          onPointerDown={(event) => event.stopPropagation()}
          style={{ left: graphLeft(keyframe.pathPosition), top: keyframe.top }}
          type="button"
        >
          {renderMarker()}
          <span className="pointer-events-none absolute bottom-[calc(100%+4px)] left-1/2 z-40 w-max max-w-48 -translate-x-1/2 rounded-md border bg-popover px-2 py-1 text-[9px] font-semibold text-popover-foreground opacity-0 shadow-lg transition-opacity group-focus-visible:opacity-100 group-hover:opacity-100">
            {keyframe.tooltip}
          </span>
        </button>
      ))}
      <ContextMenu
        items={menu ? [{
          destructive: true,
          disabled: deletingKeyframeId === menu.keyframeId,
          label: deleteLabel,
          onSelect: () => onDeleteKeyframe(menu.keyframeId),
        }] : []}
        onClose={() => setMenu(null)}
        position={menu}
      />
    </>
  );
}
