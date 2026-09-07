"use client";

import { Html } from "@react-three/drei";

import type { Vec3 } from "@/entities/project";
import { RENDER_PIPELINE_SCENE_LAYER, ScreenSpaceLine } from "@/shared/three";

interface AnchorHeightRulerProps {
  lift: number;
  surfacePosition: Vec3;
}

export function AnchorHeightRuler({ lift, surfacePosition }: AnchorHeightRulerProps) {
  const [x, y, z] = surfacePosition;

  return (
    <group>
      {lift > 0 && (
        <ScreenSpaceLine
          color="#ffffff"
          depthTest
          depthWrite={false}
          layer={RENDER_PIPELINE_SCENE_LAYER}
          points={[[x, y, z], [x, y + lift, z]]}
          radius={0.006}
          transparent
          width={2}
        />
      )}
      <Html
        center
        position={[x + 0.1, y + lift, z]}
        style={{ pointerEvents: "none" }}
      >
        <div className="whitespace-nowrap rounded-md border border-orange-400/60 bg-background/95 px-1.5 py-1 font-mono text-[10px] font-semibold text-foreground shadow-sm backdrop-blur">
          {lift.toFixed(2)} m
        </div>
      </Html>
    </group>
  );
}
