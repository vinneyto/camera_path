import { Line } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useMemo } from "react";

import type { CompiledTrajectory } from "@/entities/trajectory/model/types";
import { sampleTrajectory } from "@/entities/trajectory/lib/sample-trajectory";

interface TrajectoryLineProps {
  selected: boolean;
  trajectory: CompiledTrajectory;
  onSelect: () => void;
}

export function TrajectoryLine({ selected, trajectory, onSelect }: TrajectoryLineProps) {
  const points = useMemo(() => sampleTrajectory(trajectory), [trajectory]);
  if (points.length < 2) return null;

  function handleClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    onSelect();
  }

  return (
    <Line
      color={selected ? "#f97316" : "#171717"}
      lineWidth={selected ? 4 : 3}
      onClick={handleClick}
      points={points}
      transparent
    />
  );
}
