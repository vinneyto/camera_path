import { Html } from "@react-three/drei";
import type { ThreeElements } from "@react-three/fiber";
import { MapPin } from "lucide-react";

import type { Anchor } from "@/entities/project";
import { cn } from "@/shared/lib/cn";

const ANCHOR_MARKER_Z_INDEX_RANGE = [1000, 0];
const ANCHOR_MARKER_HOVER_HIGHLIGHT_ENABLED = false;

interface AnchorMarkerProps extends Omit<ThreeElements["group"], "children" | "position"> {
  anchor: Anchor;
  hovered?: boolean;
}

export function AnchorMarker({
  anchor,
  hovered = false,
  ...groupProps
}: AnchorMarkerProps) {
  const axis = anchor.lift_axis === "surface_normal" ? anchor.surface_normal : [0, 1, 0];
  const position = anchor.surface_position.map(
    (component, index) => component + axis[index] * anchor.lift,
  ) as [number, number, number];
  const surfaceOffset = axis.map(
    (component) => -component * anchor.lift,
  ) as [number, number, number];

  const interactive = groupProps.onContextMenu !== undefined
    || groupProps.onPointerDown !== undefined;
  const highlighted = ANCHOR_MARKER_HOVER_HIGHLIGHT_ENABLED && hovered;

  return (
    <group {...groupProps} position={position}>
      <mesh
        position={surfaceOffset}
        raycast={() => undefined}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[0.06, 32]} />
        <meshBasicMaterial
          color="#ffffff"
          depthWrite={false}
          opacity={highlighted ? 0.65 : 0.45}
          polygonOffset
          polygonOffsetFactor={-1}
          transparent
        />
      </mesh>
      {interactive && (
        <mesh position={[0, 0.1, 0]}>
          <sphereGeometry args={[0.2, 12, 12]} />
          <meshBasicMaterial depthWrite={false} opacity={0} transparent />
        </mesh>
      )}
      <Html
        distanceFactor={8}
        style={{ pointerEvents: "none" }}
        zIndexRange={ANCHOR_MARKER_Z_INDEX_RANGE}
      >
        <div className="relative size-0 select-none">
          <MapPin
            aria-hidden
            className={cn(
              "absolute bottom-0 left-0 size-3.5 -translate-x-1/2 drop-shadow-sm transition-colors",
              highlighted ? "fill-orange-400 text-orange-300" : "fill-orange-500 text-orange-400",
            )}
            strokeWidth={2}
          />
          <span
            className={cn(
              "absolute bottom-3 left-0 -translate-x-1/2 whitespace-nowrap rounded border bg-background/90 px-1 py-0.5 text-[9px] font-semibold leading-none text-foreground shadow-sm",
              highlighted ? "border-orange-300/70" : "border-orange-400/40",
            )}
          >
            {anchor.label}
          </span>
        </div>
      </Html>
    </group>
  );
}
