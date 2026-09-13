"use client";

/* eslint-disable react-hooks/immutability -- Mesh is an imperative Three.js object intentionally mutated by lifecycle effects. */
/* eslint-disable react-hooks/use-memo -- Keep the named imperative object factory explicit. */

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
  function createLine() {
    return new Mesh<
      ReturnType<typeof createScreenSpaceLineGeometry>,
      MeshBasicMaterial
    >();
  }

  const line = useMemo(createLine, []);

  useLayoutEffect(() => {
    const geometry = createScreenSpaceLineGeometry(points, radius);
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
    line.material = material;

    return () => {
      material.dispose();
    };
  }, [color, depthTest, depthWrite, line, transparent]);

  useLayoutEffect(() => {
    line.layers.set(layer);
    line.renderOrder = renderOrder;
  }, [layer, line, renderOrder]);

  return <primitive dispose={null} object={line} {...eventHandlers} />;
}
