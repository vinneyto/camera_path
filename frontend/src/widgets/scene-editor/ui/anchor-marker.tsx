import { Html } from "@react-three/drei";
import { MapPin } from "lucide-react";

import type { Anchor } from "@/entities/project";

interface AnchorMarkerProps {
  anchor: Anchor;
}

export function AnchorMarker({ anchor }: AnchorMarkerProps) {
  const axis = anchor.lift_axis === "surface_normal" ? anchor.surface_normal : [0, 1, 0];
  const position = anchor.surface_position.map(
    (component, index) => component + axis[index] * anchor.lift,
  ) as [number, number, number];

  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.055, 16, 16]} />
        <meshStandardMaterial color="#f97316" emissive="#7c2d12" emissiveIntensity={0.35} />
      </mesh>
      <Html center distanceFactor={8} position={[0, 0.22, 0]} style={{ pointerEvents: "none" }}>
        <div className="flex items-center gap-1 rounded-md border border-orange-400/50 bg-background/95 px-1.5 py-1 text-[10px] font-semibold text-foreground shadow-sm backdrop-blur">
          <MapPin className="size-3 text-orange-500" />
          {anchor.label}
        </div>
      </Html>
    </group>
  );
}
