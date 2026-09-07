import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo } from "react";

import { sampleTrajectory, type CompiledTrajectory } from "@/entities/trajectory";
import { useHoveredTrajectory } from "@/features/project-editor";
import { RENDER_PIPELINE_OVERLAY_LAYER, ScreenSpaceLine } from "@/shared/three";

interface TrajectoryLineProps {
  dark: boolean;
  interactive: boolean;
  selected: boolean;
  trajectory: CompiledTrajectory;
  onSelect: () => void;
}

export function TrajectoryLine({
  dark,
  interactive,
  selected,
  trajectory,
  onSelect,
}: TrajectoryLineProps) {
  const { clearHoveredTrajectory, hovered, hoverTrajectory } = useHoveredTrajectory();
  const points = useMemo(() => sampleTrajectory(trajectory), [trajectory]);
  const color = hovered ? "#fb923c" : selected ? "#f97316" : dark ? "#e5e7eb" : "#171717";

  useEffect(() => () => clearHoveredTrajectory(), [clearHoveredTrajectory]);
  useEffect(() => {
    if (!interactive) clearHoveredTrajectory();
  }, [clearHoveredTrajectory, interactive]);

  if (points.length < 2) return null;

  function handleClick(event: ThreeEvent<MouseEvent>) {
    if (!interactive) return;
    event.stopPropagation();
    onSelect();
  }

  function handlePointerOver(event: ThreeEvent<PointerEvent>) {
    if (!interactive || event.nativeEvent.pointerType === "touch") return;
    event.stopPropagation();
    hoverTrajectory();
  }

  function handlePointerOut(event: ThreeEvent<PointerEvent>) {
    if (event.nativeEvent.pointerType === "touch") return;
    event.stopPropagation();
    clearHoveredTrajectory();
  }

  return (
    <ScreenSpaceLine
      color={color}
      depthTest={false}
      depthWrite={false}
      hitSlop={0.025}
      onClick={handleClick}
      onPointerOut={handlePointerOut}
      onPointerOver={handlePointerOver}
      layer={RENDER_PIPELINE_OVERLAY_LAYER}
      points={points}
      radius={selected ? 0.018 : 0.014}
      transparent
      webGpuHitSlop={selected ? 6 : 6.5}
      width={selected || hovered ? 4 : 3}
    />
  );
}
