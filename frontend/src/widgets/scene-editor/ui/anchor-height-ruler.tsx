"use client";

import { Html } from "@react-three/drei";
import { useMemo } from "react";

import type { Vec3 } from "@/entities/project";
import { RENDER_PIPELINE_OVERLAY_LAYER, ScreenSpaceLine } from "@/shared/three";

interface AnchorHeightRulerProps {
  dark: boolean;
  lift: number;
  surfacePosition: Vec3;
}

export function AnchorHeightRuler({ dark, lift, surfacePosition }: AnchorHeightRulerProps) {
  const color = dark ? "#fdba74" : "#c2410c";
  const ticks = useMemo(() => {
    const step = lift <= 1 ? 0.1 : lift <= 5 ? 0.5 : 1;
    return Array.from({ length: Math.floor(lift / step) + 1 }, (_, index) => index * step);
  }, [lift]);
  const [x, y, z] = surfacePosition;

  return (
    <group>
      {lift > 0 && (
        <ScreenSpaceLine
          color={color}
          depthTest={false}
          depthWrite={false}
          layer={RENDER_PIPELINE_OVERLAY_LAYER}
          points={[[x, y, z], [x, y + lift, z]]}
          radius={0.006}
          transparent
          width={2}
        />
      )}
      {ticks.map((height) => (
        <ScreenSpaceLine
          color={color}
          depthTest={false}
          depthWrite={false}
          key={height}
          layer={RENDER_PIPELINE_OVERLAY_LAYER}
          points={[[x - 0.025, y + height, z], [x + 0.025, y + height, z]]}
          radius={0.004}
          transparent
          width={1.5}
        />
      ))}
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
