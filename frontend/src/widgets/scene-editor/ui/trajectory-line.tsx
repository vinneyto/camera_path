import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo } from "react";

import { sampleTrajectory, type CompiledTrajectory } from "@/entities/trajectory";
import { WebGpuLine } from "@/shared/three/webgpu-line";

interface TrajectoryLineProps {
  dark: boolean;
  interactive: boolean;
  selected: boolean;
  trajectory: CompiledTrajectory;
  onSelect: () => void;
}

export function TrajectoryLine({ dark, interactive, selected, trajectory, onSelect }: TrajectoryLineProps) {
  const points = useMemo(() => sampleTrajectory(trajectory), [trajectory]);

  useEffect(() => {
    if (!interactive) document.body.style.cursor = "";
    return () => { document.body.style.cursor = ""; };
  }, [interactive]);

  if (points.length < 2) return null;

  function handleClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    onSelect();
  }

  return (
    <WebGpuLine
      color={selected ? "#f97316" : dark ? "#e5e7eb" : "#171717"}
      lineWidth={selected ? 4 : 3}
      onClick={interactive ? handleClick : undefined}
      onPointerOut={interactive ? () => { document.body.style.cursor = ""; } : undefined}
      onPointerOver={interactive ? () => { document.body.style.cursor = "pointer"; } : undefined}
      points={points}
      raycastWidth={interactive ? 16 : undefined}
    />
  );
}
