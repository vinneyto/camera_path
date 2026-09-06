"use client";

import { useEffect, useMemo } from "react";
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
  const line = useMemo(() => {
    const material = new MeshBasicMaterial({
      color,
      depthTest,
      depthWrite,
      toneMapped: false,
      transparent,
    });
    const object = new Mesh(createScreenSpaceLineGeometry(points, radius), material);
    object.layers.set(layer);
    object.renderOrder = renderOrder;

    if (hitSlop > 0) {
      const hitMesh = new Mesh(createScreenSpaceLineGeometry(points, radius + hitSlop), material);
      object.raycast = (raycaster, intersections) => {
        hitMesh.matrixWorld.copy(object.matrixWorld);
        const startIndex = intersections.length;
        hitMesh.raycast(raycaster, intersections);
        for (let index = startIndex; index < intersections.length; index += 1) {
          intersections[index].object = object;
        }
      };
      object.userData.hitGeometry = hitMesh.geometry;
    }

    return object;
  }, [color, depthTest, depthWrite, hitSlop, layer, points, radius, renderOrder, transparent]);

  useEffect(() => () => {
    line.geometry.dispose();
    line.material.dispose();
    const hitGeometry = line.userData.hitGeometry;
    if (hitGeometry && typeof hitGeometry.dispose === "function") hitGeometry.dispose();
  }, [line]);

  return <primitive dispose={null} object={line} {...eventHandlers} />;
}
