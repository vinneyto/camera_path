import type { ThreeEvent } from "@react-three/fiber";
import { useMemo } from "react";

import { sampleTrajectory, type CompiledTrajectory } from "@/entities/trajectory";
import { WebGpuLine } from "@/shared/three/webgpu-line";

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
    <WebGpuLine
      color={selected ? "#f97316" : dark ? "#e5e7eb" : "#171717"}
      lineWidth={selected ? 4 : 3}
      onClick={handleClick}
      onPointerOut={() => { document.body.style.cursor = ""; }}
      onPointerOver={() => { document.body.style.cursor = "pointer"; }}
      points={points}
      raycastWidth={16}
    />
  );
}
