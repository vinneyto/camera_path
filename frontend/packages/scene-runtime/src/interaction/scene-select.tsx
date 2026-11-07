"use client";
import {
  configureInteractiveRaycasterLayers,
  SELECTABLE,
} from "@camera-path/render-pipeline";
import { POINTER_BUTTON } from "@camera-path/ui-kit/constants";
import { useThree } from "@react-three/fiber";
import { useEffect, useEffectEvent } from "react";
import { Raycaster } from "three";
import { SELECT_CLICK_MAX_DISTANCE } from "./constants";
import { findInteractiveSceneObject } from "./find-interactive-scene-object";
import { raycastSceneAtPointer } from "./raycast-scene-at-pointer";

export function SceneSelect({
  enabled,
  onSelect,
}: {
  enabled: boolean;
  onSelect: (id: string | null) => void;
}) {
  const get = useThree((state) => state.get);
  const canvas = useThree((state) => state.gl.domElement);
  const notify = useEffectEvent(onSelect);
  useEffect(() => {
    if (!enabled) return;
    const raycaster = new Raycaster();
    configureInteractiveRaycasterLayers(raycaster);
    const pointers = new Set<number>();
    let start: PointerEvent | null = null;
    function cancel() {
      start = null;
      pointers.clear();
    }
    function down(event: PointerEvent) {
      pointers.add(event.pointerId);
      start =
        pointers.size === 1 &&
        event.isPrimary &&
        event.button === POINTER_BUTTON.primary
          ? event
          : null;
    }
    function move(event: PointerEvent) {
      if (start?.pointerId !== event.pointerId) return;
      if (
        Math.hypot(
          event.clientX - start.clientX,
          event.clientY - start.clientY,
        ) > SELECT_CLICK_MAX_DISTANCE
      )
        start = null;
    }
    function up(event: PointerEvent) {
      const origin = start;
      pointers.delete(event.pointerId);
      if (origin?.pointerId !== event.pointerId) return;
      start = null;
      const rect = canvas.getBoundingClientRect();
      if (
        event.button !== POINTER_BUTTON.primary ||
        Math.hypot(
          event.clientX - origin.clientX,
          event.clientY - origin.clientY,
        ) > SELECT_CLICK_MAX_DISTANCE ||
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        return;
      const object = findInteractiveSceneObject(
        raycastSceneAtPointer(raycaster, get(), rect, event),
        SELECTABLE,
      );
      notify(object?.userData.sceneObjectID ?? null);
    }
    const target = canvas.ownerDocument.defaultView!;
    canvas.addEventListener("pointerdown", down, true);
    target.addEventListener("pointermove", move, true);
    target.addEventListener("pointerup", up, true);
    target.addEventListener("pointercancel", cancel, true);
    target.addEventListener("blur", cancel);
    return () => {
      canvas.removeEventListener("pointerdown", down, true);
      target.removeEventListener("pointermove", move, true);
      target.removeEventListener("pointerup", up, true);
      target.removeEventListener("pointercancel", cancel, true);
      target.removeEventListener("blur", cancel);
      cancel();
    };
  }, [canvas, enabled, get]);
  return null;
}
