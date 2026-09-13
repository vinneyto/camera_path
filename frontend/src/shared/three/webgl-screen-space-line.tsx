"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
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
  const line = useMemo(
    () =>
      new Mesh<
        ReturnType<typeof createScreenSpaceLineGeometry>,
        MeshBasicMaterial
      >(),
    [],
  );
  const lineRef = useRef(line);

  useLayoutEffect(() => {
    if (!lineRef.current) {
      return;
    }

    const geometry = createScreenSpaceLineGeometry(points, radius);
    lineRef.current.geometry = geometry;
    lineRef.current.raycast = Mesh.prototype.raycast;
    let hitGeometry: ReturnType<typeof createScreenSpaceLineGeometry> | null =
      null;

    if (hitSlop > 0) {
      hitGeometry = createScreenSpaceLineGeometry(points, radius + hitSlop);
      const hitMesh = new Mesh(hitGeometry);
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
      hitGeometry?.dispose();
    };
  }, [hitSlop, points, radius]);

  useLayoutEffect(() => {
    if (!lineRef.current) {
      return;
    }

    const material = new MeshBasicMaterial({
      color,
      depthTest,
      depthWrite,
      toneMapped: false,
      transparent,
    });
    lineRef.current.material = material;

    return () => {
      material.dispose();
    };
  }, [color, depthTest, depthWrite, transparent]);

  useLayoutEffect(() => {
    if (!lineRef.current) {
      return;
    }

    lineRef.current.layers.set(layer);
    lineRef.current.renderOrder = renderOrder;
  }, [layer, renderOrder]);

  return <primitive dispose={null} object={line} {...eventHandlers} />;
}
