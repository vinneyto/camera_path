"use client";
import { Html } from "@react-three/drei";
import type { ThreeElements } from "@react-three/fiber";
import { MapPin } from "lucide-react";

import { SurfaceTargetRing } from "@camera-path/scene-runtime/three/surface-target-ring";
import type { Anchor } from "@camera-path/types/project";
import { ANCHOR_ICON_Z_INDEX_RANGE } from "@camera-path/ui-kit";
import { cn } from "@camera-path/ui-kit/lib/cn";
import {
  ANCHOR_ICON_STROKE_WIDTH,
  ANCHOR_LABEL_DISTANCE_FACTOR,
  ANCHOR_MARKER_HIT_POSITION,
  ANCHOR_MARKER_HIT_RADIUS,
  ANCHOR_MARKER_HIT_SEGMENTS,
} from "../constants";
import { selectAnchorMarkerAppearance } from "../selectors/select-anchor-marker-appearance";
import { AnchorSelectionCollider } from "./anchor-selection-collider";

export interface AnchorMarkerProps extends Omit<
  ThreeElements["group"],
  "children" | "position"
> {
  anchor: Anchor;
  hovered?: boolean;
  selected?: boolean;
  dragging?: boolean;
  selectable?: boolean;
}

export function AnchorMarkerContent({
  anchor,
  hovered = false,
  selected = false,
  dragging = false,
  selectable = false,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  ...groupProps
}: AnchorMarkerProps) {
  const axis =
    anchor.lift_axis === "surface_normal" ? anchor.surface_normal : [0, 1, 0];
  const position = anchor.surface_position.map(
    (component, index) => component + axis[index] * anchor.lift,
  ) as [number, number, number];
  const surfaceOffset = axis.map((component) => -component * anchor.lift) as [
    number,
    number,
    number,
  ];

  const interactive =
    groupProps.onContextMenu !== undefined || onPointerDown !== undefined;
  const appearance = selectAnchorMarkerAppearance({
    hovered,
    selected,
    dragging,
  });

  return (
    <group {...groupProps} position={position}>
      <SurfaceTargetRing
        highlighted={appearance.highlighted}
        position={surfaceOffset}
      />
      {selectable && <AnchorSelectionCollider surfaceOffset={surfaceOffset} />}
      {(interactive || selectable) && (
        <mesh
          name="anchor-height-handle"
          position={ANCHOR_MARKER_HIT_POSITION}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        >
          <sphereGeometry
            args={[
              ANCHOR_MARKER_HIT_RADIUS,
              ANCHOR_MARKER_HIT_SEGMENTS,
              ANCHOR_MARKER_HIT_SEGMENTS,
            ]}
          />
          <meshBasicMaterial depthWrite={false} opacity={0} transparent />
        </mesh>
      )}
      <Html
        distanceFactor={ANCHOR_LABEL_DISTANCE_FACTOR}
        style={{ pointerEvents: "none" }}
        zIndexRange={ANCHOR_ICON_Z_INDEX_RANGE}
      >
        <div className="relative size-0 select-none">
          <MapPin
            aria-hidden
            className={cn(
              "absolute bottom-0 left-0 size-3.5 -translate-x-1/2 drop-shadow-sm transition-colors",
              appearance.iconColorClass,
            )}
            strokeWidth={ANCHOR_ICON_STROKE_WIDTH}
          />
          <span
            className={cn(
              "absolute bottom-3 left-0 -translate-x-1/2 whitespace-nowrap rounded border bg-background/90 px-1 py-0.5 text-[9px] font-semibold leading-none text-foreground shadow-sm",
              appearance.labelBorderClass,
            )}
          >
            {anchor.label}
          </span>
        </div>
      </Html>
    </group>
  );
}
