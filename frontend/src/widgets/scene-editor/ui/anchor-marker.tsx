import { Html } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { MapPin } from "lucide-react";

import type { Anchor } from "@/entities/project";

interface AnchorMarkerProps {
  anchor: Anchor;
  onContextMenu: (anchor: Anchor, position: { x: number; y: number }) => void;
}

export function AnchorMarker({ anchor, onContextMenu }: AnchorMarkerProps) {
  const axis = anchor.lift_axis === "surface_normal" ? anchor.surface_normal : [0, 1, 0];
  const position = anchor.surface_position.map(
    (component, index) => component + axis[index] * anchor.lift,
  ) as [number, number, number];

  function handleContextMenu(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    event.nativeEvent.preventDefault();
    onContextMenu(anchor, {
      x: event.nativeEvent.clientX,
      y: event.nativeEvent.clientY,
    });
  }

  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.055, 16, 16]} />
        <meshStandardMaterial color="#f97316" emissive="#7c2d12" emissiveIntensity={0.35} />
      </mesh>
      <mesh onContextMenu={handleContextMenu}>
        <sphereGeometry args={[0.14, 12, 12]} />
        <meshBasicMaterial depthWrite={false} opacity={0} transparent />
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
