"use client";
import { configureInteractiveRaycasterLayers } from "@camera-path/render-pipeline";
import { useThree } from "@react-three/fiber";
import { useEffect, useEffectEvent } from "react";
import { Raycaster, type Object3D } from "three";
import { findHoveredSceneObject } from "./find-hovered-scene-object";
import { raycastSceneAtPointer } from "./raycast-scene-at-pointer";

export function SceneHover({
  enabled,
  onHover,
}: {
  enabled: boolean;
  onHover: (id: string | null) => void;
}) {
  const get = useThree((state) => state.get);
  const canvas = useThree((state) => state.gl.domElement);
  const notify = useEffectEvent(onHover);
  useEffect(() => {
    if (!enabled) {
      notify(null);
      return;
    }
    const raycaster = new Raycaster();
    configureInteractiveRaycasterLayers(raycaster);
    let hovered: Object3D | null = null;
    function clear() {
      hovered?.removeEventListener("removed", clear);
      hovered = null;
      notify(null);
    }
    function move(event: PointerEvent) {
      if (event.pointerType === "touch") {
        clear();
        return;
      }
      // Camera and authoring drags retain their own pointer handling.
      if (event.buttons !== 0) return;
      const next = findHoveredSceneObject(
        raycastSceneAtPointer(
          raycaster,
          get(),
          canvas.getBoundingClientRect(),
          event,
        ),
      );
      if (next !== hovered) {
        hovered?.removeEventListener("removed", clear);
        hovered = next;
        hovered?.addEventListener("removed", clear);
      }
      notify(next?.userData.sceneObjectID ?? null);
    }
    // Capture keeps per-object stopPropagation/capture out of hover resolution.
    canvas.addEventListener("pointermove", move, true);
    canvas.addEventListener("pointerleave", clear);
    canvas.addEventListener("pointercancel", clear);
    return () => {
      canvas.removeEventListener("pointermove", move, true);
      canvas.removeEventListener("pointerleave", clear);
      canvas.removeEventListener("pointercancel", clear);
      clear();
    };
  }, [canvas, enabled, get]);
  return null;
}
