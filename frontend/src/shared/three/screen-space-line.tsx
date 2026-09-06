"use client";

import type { EventHandlers } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { Mesh, MeshBasicMaterial, type ColorRepresentation, type Vector3 } from "three";

import { createScreenSpaceLineGeometry } from "./create-screen-space-line-geometry";

export type ScreenSpaceLinePoint = Vector3 | readonly [number, number, number];

export interface ScreenSpaceLineProps extends Pick<
  EventHandlers,
  "onClick" | "onPointerOut" | "onPointerOver"
> {
  color: ColorRepresentation;
  depthTest?: boolean;
  depthWrite?: boolean;
  hitSlop?: number;
  points: readonly ScreenSpaceLinePoint[];
  radius?: number;
  renderOrder?: number;
}

export function ScreenSpaceLine({
  color,
  depthTest = true,
  depthWrite = true,
  hitSlop = 0,
  points,
  radius = 0.01,
  renderOrder = 0,
  ...eventHandlers
}: ScreenSpaceLineProps) {
  const line = useMemo(() => {
    const material = new MeshBasicMaterial({ color, depthTest, depthWrite, toneMapped: false });
    const object = new Mesh(createScreenSpaceLineGeometry(points, radius), material);
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
  }, [color, depthTest, depthWrite, hitSlop, points, radius, renderOrder]);

  useEffect(() => () => {
    line.geometry.dispose();
    line.material.dispose();
    const hitGeometry = line.userData.hitGeometry;
    if (hitGeometry && typeof hitGeometry.dispose === "function") hitGeometry.dispose();
  }, [line]);

  return <primitive dispose={null} object={line} {...eventHandlers} />;
}
