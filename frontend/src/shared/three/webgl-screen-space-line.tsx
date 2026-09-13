"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Mesh, MeshBasicMaterial } from "three";

import { createScreenSpaceLineGeometry } from "./create-screen-space-line-geometry";
import type { ScreenSpaceLineProps } from "./screen-space-line";

type WebGlScreenSpaceLineProps = Omit<
  ScreenSpaceLineProps,
  "webGpuHitSlop" | "width"
>;

export function WebGlScreenSpaceLine({
  color,
  depthTest = true,
  depthWrite = true,
  hitSlop = 0,
  layer = 0,
  points,
  radius = 0.01,
  renderOrder = 0,
  transparent = false,
  ...eventHandlers
}: WebGlScreenSpaceLineProps) {
  const [line] = useState(
    () =>
      new Mesh<
        ReturnType<typeof createScreenSpaceLineGeometry>,
        MeshBasicMaterial
      >(),
  );
  const lineRef = useRef(line);
  const initialResourcesRef = useRef<{
    geometry: typeof line.geometry;
    material: typeof line.material;
  } | null>({
    geometry: line.geometry,
    material: line.material,
  });

  useLayoutEffect(() => {
    const initialResources = initialResourcesRef.current;
    if (initialResources !== null) {
      initialResources.geometry.dispose();
      initialResources.material.dispose();
      initialResourcesRef.current = null;
    }

    const material = new MeshBasicMaterial({
      color,
      depthTest,
      depthWrite,
      toneMapped: false,
      transparent,
    });
    const geometry = createScreenSpaceLineGeometry(points, radius);
    let hitGeometry: ReturnType<typeof createScreenSpaceLineGeometry> | null =
      null;
    lineRef.current.geometry = geometry;
    lineRef.current.material = material;
    lineRef.current.layers.set(layer);
    lineRef.current.renderOrder = renderOrder;
    lineRef.current.raycast = Mesh.prototype.raycast;

    if (hitSlop > 0) {
      hitGeometry = createScreenSpaceLineGeometry(points, radius + hitSlop);
      const hitMesh = new Mesh(hitGeometry, material);
      lineRef.current.raycast = (raycaster, intersections) => {
        hitMesh.matrixWorld.copy(lineRef.current.matrixWorld);
        const startIndex = intersections.length;
        hitMesh.raycast(raycaster, intersections);
        for (let index = startIndex; index < intersections.length; index += 1) {
          intersections[index].object = lineRef.current;
        }
      };
    }

    return () => {
      geometry.dispose();
      material.dispose();
      hitGeometry?.dispose();
    };
  }, [
    color,
    depthTest,
    depthWrite,
    hitSlop,
    layer,
    points,
    radius,
    renderOrder,
    transparent,
  ]);

  return <primitive dispose={null} object={line} {...eventHandlers} />;
}
