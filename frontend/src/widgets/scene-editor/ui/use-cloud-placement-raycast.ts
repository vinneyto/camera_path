import { useThree } from "@react-three/fiber";
import { useEffect, useEffectEvent } from "react";
import { Raycaster, Vector2 } from "three";
import { raycastPlacementSurfaces } from "./raycast-placement-surfaces";
import type { useCloudPlacementInteraction } from "./use-cloud-placement-interaction";

export function useCloudPlacementRaycast(
  enabled: boolean,
  placement: ReturnType<typeof useCloudPlacementInteraction>,
) {
  const { gl, camera, scene } = useThree();
  const pointerEvents = useEffectEvent(() => placement.pointerEvents);
  useEffect(() => {
    if (!enabled) return;
    const canvas = gl.domElement;
    const raycaster = new Raycaster();
    raycaster.layers.enableAll();
    const pointer = new Vector2();
    function hit(event: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      camera.updateWorldMatrix(true, false);
      raycaster.setFromCamera(pointer, camera);
      raycaster.near = camera.near;
      raycaster.far = camera.far;
      return raycastPlacementSurfaces(scene, raycaster);
    }
    const down = (event: PointerEvent) => {
      if (event.button !== 0) return;
      pointerEvents().onPointerDown(hit(event), event);
      canvas.setPointerCapture?.(event.pointerId);
    };
    const move = (event: PointerEvent) =>
      pointerEvents().onPointerMove(hit(event), event);
    const up = (event: PointerEvent) => {
      pointerEvents().onPointerUp(hit(event), event);
      if (canvas.hasPointerCapture?.(event.pointerId))
        canvas.releasePointerCapture(event.pointerId);
    };
    const leave = () => pointerEvents().onPointerLeave();
    const cancel = () => pointerEvents().onPointerCancel();
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointerleave", leave);
    canvas.addEventListener("pointercancel", cancel);
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointerleave", leave);
      canvas.removeEventListener("pointercancel", cancel);
    };
  }, [enabled, gl, camera, scene]);
}
