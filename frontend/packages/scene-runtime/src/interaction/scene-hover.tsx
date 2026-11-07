"use client";
import { configureInteractiveRaycasterLayers } from "@camera-path/render-pipeline";
import { useThree } from "@react-three/fiber";
import { useEffect, useEffectEvent } from "react";
import { Raycaster, Vector2, type Object3D } from "three";
import { findHoveredSceneObject } from "./find-hovered-scene-object";

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
    const pointer = new Vector2();
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
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        clear();
        return;
      }
      const { camera, scene } = get();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      scene.updateMatrixWorld();
      camera.updateWorldMatrix(true, false);
      raycaster.setFromCamera(pointer, camera);
      raycaster.near = camera.near;
      raycaster.far = camera.far;
      // Raycaster itself does not skip invisible objects/ancestors. Flattening
      // visible objects also avoids recursively picking each child twice.
      const objects: Object3D[] = [];
      scene.traverseVisible((object) => objects.push(object));
      const next = findHoveredSceneObject(
        raycaster.intersectObjects(objects, false),
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
