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
import { selectTrajectoryLineAppearance } from "../selectors/select-trajectory-line-appearance";
import { TRAJECTORY_LINE_MIN_POINTS } from "../constants";
import { POINTER_BUTTON } from "@camera-path/ui-kit/constants";

interface TrajectoryLineProps {
  dark: boolean;
  interactive: boolean;
  trajectory: Pick<CompiledTrajectory, "position_segments">;
  onOpenMenu: (position: ContextMenuPosition) => void;
}

export function TrajectoryLine({
  dark,
  interactive,
  trajectory,
  onOpenMenu,
}: TrajectoryLineProps) {
  const points = sampleTrajectory(trajectory);
  if (points.length < TRAJECTORY_LINE_MIN_POINTS) return null;

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
    if (!interactive || event.button !== POINTER_BUTTON.secondary) return;
    event.stopPropagation();
    event.nativeEvent.preventDefault();
  }

  return (
    <SceneObject
      sceneObjectID={trajectoryObjectId}
      hoverable={interactive}
      selectable={interactive}
    >
      {({ hovered, selected }) => (
        <ScreenSpaceLine
          {...selectTrajectoryLineAppearance({ dark, hovered, selected })}
          depthTest={false}
          depthWrite={false}
          onContextMenu={handleContextMenu}
          onPointerDown={handlePointerDown}
          layer={RENDER_PIPELINE_OVERLAY_LAYER}
          points={points}
          transparent
        />
      )}
    </SceneObject>
  );
}
