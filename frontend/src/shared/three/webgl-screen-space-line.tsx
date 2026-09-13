"use client";

import { useLayoutEffect, useMemo } from "react";
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

  useLayoutEffect(() => {
    const geometry = createScreenSpaceLineGeometry(points, radius);
    // eslint-disable-next-line react-hooks/immutability
    line.geometry = geometry;
    line.raycast = Mesh.prototype.raycast;
    let hitGeometry: ReturnType<typeof createScreenSpaceLineGeometry> | null =
      null;

    if (hitSlop > 0) {
      hitGeometry = createScreenSpaceLineGeometry(points, radius + hitSlop);
      const hitMesh = new Mesh(hitGeometry);
      line.raycast = (raycaster, intersections) => {
        hitMesh.matrixWorld.copy(line.matrixWorld);
        const startIndex = intersections.length;
        hitMesh.raycast(raycaster, intersections);
        for (let index = startIndex; index < intersections.length; index += 1) {
          intersections[index].object = line;
        }
      };
    }

    return () => {
      geometry.dispose();
      hitGeometry?.dispose();
    };
  }, [hitSlop, line, points, radius]);

  useLayoutEffect(() => {
    const material = new MeshBasicMaterial({
      color,
      depthTest,
      depthWrite,
      toneMapped: false,
      transparent,
    });
    // eslint-disable-next-line react-hooks/immutability
    line.material = material;

    return () => {
      material.dispose();
    };
  }, [color, depthTest, depthWrite, line, transparent]);

  useLayoutEffect(() => {
    line.layers.set(layer);
    // eslint-disable-next-line react-hooks/immutability
    line.renderOrder = renderOrder;
  }, [layer, line, renderOrder]);

  return <primitive dispose={null} object={line} {...eventHandlers} />;
}
