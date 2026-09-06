"use client";

import { useEffect, useMemo } from "react";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { Line2 } from "three/addons/lines/webgpu/Line2.js";
import { Line2NodeMaterial } from "three/webgpu";

import type { ScreenSpaceLineProps } from "./screen-space-line";

type WebGpuScreenSpaceLineProps = Omit<
  ScreenSpaceLineProps,
  "radius" | "webGpuHitSlop"
>;

export function WebGpuScreenSpaceLine({
  color,
  depthTest = true,
  depthWrite = true,
  hitSlop = 0,
  layer = 0,
  points,
  renderOrder = 0,
  transparent = false,
  width = 1,
  ...eventHandlers
}: WebGpuScreenSpaceLineProps) {
  const line = useMemo(() => {
    const geometry = new LineGeometry();
    geometry.setPositions(
      points.flatMap((point) => "toArray" in point ? point.toArray() : [...point]),
    );

    const material = new Line2NodeMaterial({
      color,
      depthTest,
      depthWrite,
      linewidth: width,
      toneMapped: false,
      transparent,
      worldUnits: false,
    });
    const object = new Line2(geometry, material);
    object.layers.set(layer);
    object.renderOrder = renderOrder;

    const raycastThreshold = Math.max(0, hitSlop) * 2;
    if (raycastThreshold > 0) {
      const raycast = object.raycast.bind(object);
      object.raycast = (raycaster, intersections) => {
        const previous = raycaster.params.Line2;
        raycaster.params.Line2 = { threshold: raycastThreshold };
        try {
          raycast(raycaster, intersections);
        } finally {
          raycaster.params.Line2 = previous;
        }
      };
    }

    return object;
  }, [color, depthTest, depthWrite, hitSlop, layer, points, renderOrder, transparent, width]);

  useEffect(() => () => {
    line.geometry.dispose();
    line.material.dispose();
  }, [line]);

  return <primitive dispose={null} object={line} {...eventHandlers} />;
}
