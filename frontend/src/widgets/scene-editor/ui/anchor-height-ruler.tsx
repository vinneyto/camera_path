"use client";

import { Html } from "@react-three/drei";

import type { Vec3 } from "@/entities/project";

interface AnchorHeightRulerProps {
  lift: number;
  surfacePosition: Vec3;
}

export function AnchorHeightRuler({ lift, surfacePosition }: AnchorHeightRulerProps) {
  const [x, y, z] = surfacePosition;

  return (
    <group>
      <Html
        center
        position={[x + 0.1, y + lift / 2, z]}
        style={{ pointerEvents: "none" }}
      >
        <div className="whitespace-nowrap rounded-md border border-orange-400/60 bg-background/95 px-1.5 py-1 font-mono text-[10px] font-semibold text-foreground shadow-sm backdrop-blur">
          {lift.toFixed(2)} m
        </div>
      </Html>
    </group>
  );
}
