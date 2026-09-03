import { Line } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo } from "react";

import { sampleTrajectory, type CompiledTrajectory } from "@/entities/trajectory";

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
    <group>
      <Line
        color={selected ? "#f97316" : dark ? "#e5e7eb" : "#171717"}
        lineWidth={selected ? 4 : 3}
        points={points}
      />
      {interactive && (
        <Line
          color="#000000"
          depthWrite={false}
          lineWidth={16}
          onClick={handleClick}
          onPointerOut={() => { document.body.style.cursor = ""; }}
          onPointerOver={() => { document.body.style.cursor = "pointer"; }}
          opacity={0}
          points={points}
          transparent
        />
      )}
    </group>
  );
}
