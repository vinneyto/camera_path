"use client";
import { useSceneServices } from "@camera-path/scene-runtime/viewport/scene-services-provider";
import { useViewportServices } from "@camera-path/scene-runtime/viewport/viewport-provider";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffectEvent, useLayoutEffect, useRef } from "react";
import { Vector3, type PerspectiveCamera } from "three";
import { createFreeFlightControls } from "../lib/create-free-flight-controls";
import { applyFreeFlightProjection } from "../lib/apply-free-flight-projection";

export function FreeFlightCamera({ enabled }: { enabled: boolean }) {
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  const element = useThree((state) => state.gl.domElement);
  const services = useSceneServices();
  const { setOrbitTarget } = services;
  const viewport = useViewportServices();
  const controls = useRef<ReturnType<typeof createFreeFlightControls> | null>(
    null,
  );
  const getOrbitDistance = useEffectEvent(() =>
    Math.max(
      camera.position.distanceTo(new Vector3(...services.orbitTarget)),
      1,
    ),
  );

  useLayoutEffect(() => {
    const distance = getOrbitDistance();
    const saved = {
      near: camera.near,
      far: camera.far,
      fov: camera.fov,
      zoom: camera.zoom,
      up: camera.up.clone(),
    };
    applyFreeFlightProjection(camera);
    return () => {
      camera.near = saved.near;
      camera.far = saved.far;
      camera.fov = saved.fov;
      camera.zoom = saved.zoom;
      camera.up.copy(saved.up);
      camera.updateProjectionMatrix();
      // Resume orbiting around a point ahead, preserving the flight's final pose.
      const target = camera
        .getWorldDirection(new Vector3())
        .multiplyScalar(distance)
        .add(camera.position);
      setOrbitTarget(target.toArray());
    };
  }, [camera, setOrbitTarget]);

  useLayoutEffect(() => {
    if (!enabled) return;
    const instance = createFreeFlightControls(
      camera,
      element,
      () => viewport.events.emit("controlsStart", undefined),
      () => viewport.events.emit("controlsChange", undefined),
    );
    controls.current = instance;
    return () => {
      instance.dispose();
      controls.current = null;
    };
  }, [camera, element, enabled, viewport]);

  useFrame((_, delta) => {
    // Framing a newly loaded model must not replace the fixed flight frustum.
    applyFreeFlightProjection(camera);
    controls.current?.update(delta);
  }, -1);

  return null;
}
