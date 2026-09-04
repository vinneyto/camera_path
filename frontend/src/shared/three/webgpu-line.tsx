"use client";

import type { EventHandlers } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import type { ColorRepresentation, Vector3 } from "three";
import { Line2NodeMaterial } from "three/webgpu";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { Line2 } from "three/addons/lines/webgpu/Line2.js";

type LinePoint = Vector3 | readonly [number, number, number];

interface WebGpuLineProps extends Pick<EventHandlers, "onClick" | "onPointerOut" | "onPointerOver"> {
  color: ColorRepresentation;
  depthTest?: boolean;
  depthWrite?: boolean;
  lineWidth?: number;
  points: readonly LinePoint[];
  raycastWidth?: number;
  renderOrder?: number;
}

function flattenPoints(points: readonly LinePoint[]) {
  return points.flatMap((point) => "toArray" in point ? point.toArray() : [...point]);
}

export function WebGpuLine({
  color,
  depthTest = true,
  depthWrite = true,
  lineWidth = 1,
  points,
  raycastWidth = lineWidth,
  renderOrder = 0,
  ...eventHandlers
}: WebGpuLineProps) {
  const line = useMemo(() => {
    const geometry = new LineGeometry();
    geometry.setPositions(flattenPoints(points));

    const material = new Line2NodeMaterial({
      color,
      depthTest,
      depthWrite,
      linewidth: lineWidth,
      toneMapped: false,
      worldUnits: false,
    });
    const object = new Line2(geometry, material);
    object.renderOrder = renderOrder;

    if (raycastWidth > lineWidth) {
      const raycast = object.raycast.bind(object);
      object.raycast = (raycaster, intersections) => {
        const previous = raycaster.params.Line2;
        raycaster.params.Line2 = { threshold: raycastWidth - lineWidth };
        try {
          raycast(raycaster, intersections);
        } finally {
          raycaster.params.Line2 = previous;
        }
      };
    }

    return object;
  }, [color, depthTest, depthWrite, lineWidth, points, raycastWidth, renderOrder]);

  useEffect(() => () => {
    line.geometry.dispose();
    line.material.dispose();
  }, [line]);

  return <primitive dispose={null} object={line} {...eventHandlers} />;
}
