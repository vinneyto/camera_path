"use client";
import type { ThreeEvent } from "@react-three/fiber";

import { RENDER_PIPELINE_OVERLAY_LAYER } from "@camera-path/render-pipeline";
import { ScreenSpaceLine } from "@camera-path/scene-runtime/three";
import {
  sampleTrajectory,
  type CompiledTrajectory,
} from "@camera-path/trajectory-math";
import type { ContextMenuPosition } from "@camera-path/ui-kit";
import { SceneObject } from "@camera-path/scene-runtime/interaction/scene-object";
import { trajectoryObjectId } from "@camera-path/types/trajectory-object-id";

interface TrajectoryLineProps {
  dark: boolean;
  interactive: boolean;
  selected: boolean;
  trajectory: Pick<CompiledTrajectory, "position_segments">;
  onOpenMenu: (position: ContextMenuPosition) => void;
  onSelect: () => void;
}

export function TrajectoryLine({
  dark,
  interactive,
  selected,
  trajectory,
  onOpenMenu,
  onSelect,
}: TrajectoryLineProps) {
  const points = sampleTrajectory(trajectory);
  if (points.length < 2) return null;

  function handleClick(event: ThreeEvent<MouseEvent>) {
    if (!interactive) return;
    event.stopPropagation();
    onSelect();
  }

  function handleContextMenu(event: ThreeEvent<MouseEvent>) {
    if (!interactive) return;
    event.stopPropagation();
    event.nativeEvent.preventDefault();
    onOpenMenu({
      x: event.nativeEvent.clientX,
      y: event.nativeEvent.clientY,
    });
  }

  function handlePointerDown(event: ThreeEvent<PointerEvent>) {
    if (!interactive || event.button !== 2) return;
    event.stopPropagation();
    event.nativeEvent.preventDefault();
  }

  return (
    <SceneObject sceneObjectID={trajectoryObjectId} hoverable={interactive}>
      {({ hovered }) => (
        <ScreenSpaceLine
          color={
            hovered
              ? "#fb923c"
              : selected
                ? "#f97316"
                : dark
                  ? "#e5e7eb"
                  : "#171717"
          }
          depthTest={false}
          depthWrite={false}
          hitSlop={0.025}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          onPointerDown={handlePointerDown}
          layer={RENDER_PIPELINE_OVERLAY_LAYER}
          points={points}
          radius={selected ? 0.018 : 0.014}
          transparent
          webGpuHitSlop={selected ? 6 : 6.5}
          width={selected || hovered ? 4 : 3}
        />
      )}
    </SceneObject>
  );
}
