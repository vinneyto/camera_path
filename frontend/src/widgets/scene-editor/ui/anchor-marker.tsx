import { Html } from "@react-three/drei";
import type { ThreeElements } from "@react-three/fiber";
import { MapPin } from "lucide-react";

import type { Anchor } from "@/entities/project";

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

  const interactive = groupProps.onContextMenu !== undefined
    || groupProps.onPointerDown !== undefined;

  return (
    <group {...groupProps} position={position}>
      <mesh>
        <sphereGeometry args={[0.045, 16, 16]} />
        <meshStandardMaterial
          color={hovered ? "#fb923c" : "#f97316"}
          emissive="#7c2d12"
          emissiveIntensity={hovered ? 0.45 : 0.35}
        />
      </mesh>
      {interactive && (
        <mesh position={[0, 0.1, 0]}>
          <sphereGeometry args={[0.2, 12, 12]} />
          <meshBasicMaterial depthWrite={false} opacity={0} transparent />
        </mesh>
      )}
      <Html center distanceFactor={8} position={[0, 0.22, 0]} style={{ pointerEvents: "none" }}>
        <div className="flex items-center gap-1 rounded-md border border-orange-400/50 bg-background/95 px-1.5 py-1 text-[10px] font-semibold text-foreground shadow-sm backdrop-blur">
          <MapPin className="size-3 text-orange-500" />
          {anchor.label}
        </div>
      </Html>
    </group>
  );
}
