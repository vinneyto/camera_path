import type { ThreeEvent } from "@react-three/fiber";
import { useMemo } from "react";

import { sampleTrajectory, type CompiledTrajectory } from "@/entities/trajectory";
import { RENDER_PIPELINE_OVERLAY_LAYER, ScreenSpaceLine } from "@/shared/three";

interface TrajectoryLineProps {
  dark: boolean;
  selected: boolean;
  trajectory: CompiledTrajectory;
  onSelect: () => void;
}

export function TrajectoryLine({ dark, selected, trajectory, onSelect }: TrajectoryLineProps) {
  const points = useMemo(() => sampleTrajectory(trajectory), [trajectory]);
  if (points.length < 2) return null;

  function handleClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    onSelect();
  }

  return (
    <ScreenSpaceLine
      color={selected ? "#f97316" : dark ? "#e5e7eb" : "#171717"}
      depthTest={false}
      depthWrite={false}
      hitSlop={0.025}
      onClick={handleClick}
      onPointerOut={() => { document.body.style.cursor = ""; }}
      onPointerOver={() => { document.body.style.cursor = "pointer"; }}
      layer={RENDER_PIPELINE_OVERLAY_LAYER}
      points={points}
      radius={selected ? 0.018 : 0.014}
      transparent
      webGpuHitSlop={selected ? 6 : 6.5}
      width={selected ? 4 : 3}
    />
  );
}
