"use client";
import { useEffect, useEffectEvent, useState } from "react";
import { SceneObjectInteractor } from "@camera-path/scene-runtime/interaction/scene-object-interactor";
import type { SceneSurfaceBounds } from "@camera-path/scene-runtime/surface";
import type { CloudSceneObjectProps } from "./cloud-scene-object";
import { PrimitiveSurface } from "./primitive-surface";
import { transformSceneObjectBounds } from "./transform-scene-object-bounds";

export function PrimitiveSceneObject({
  cloud,
  worldMatrix,
  parentMatrix,
  parentRotation,
  transformInteraction,
  transformEditable = false,
  effectiveVisible,
  hoverable = true,
  selectable = true,
  onReady,
  onError,
  raycastable,
  onSurfacePointerDown,
  onSurfacePointerMove,
  onSurfacePointerUp,
  onPointerOut,
  onPointerCancel,
}: CloudSceneObjectProps) {
  const [bounds, setBounds] = useState<SceneSurfaceBounds | null>(null);
  const notifyBounds = useEffectEvent(() => {
    if (bounds)
      onReady?.({ bounds: transformSceneObjectBounds(bounds, worldMatrix) });
  });
  useEffect(() => {
    notifyBounds();
  }, [bounds, worldMatrix, effectiveVisible]);
  return (
    <SceneObjectInteractor
      model={cloud}
      worldMatrix={worldMatrix}
      parentMatrix={parentMatrix}
      parentRotation={parentRotation}
      interaction={transformInteraction}
      editable={transformEditable && effectiveVisible}
      hoverable={hoverable && effectiveVisible}
      selectable={selectable && effectiveVisible}
      visible={effectiveVisible}
    >
      {({ hovered, selected }) => (
        <PrimitiveSurface
          parameters={cloud.primitive!}
          name={cloud.id}
          hovered={hovered}
          selected={selected}
          onReady={({ bounds }) => setBounds(bounds)}
          onError={onError}
          raycastable={raycastable}
          onSurfacePointerDown={onSurfacePointerDown}
          onSurfacePointerMove={onSurfacePointerMove}
          onSurfacePointerUp={onSurfacePointerUp}
          onPointerOut={onPointerOut}
          onPointerCancel={onPointerCancel}
        />
      )}
    </SceneObjectInteractor>
  );
}
