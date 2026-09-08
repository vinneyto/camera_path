"use client";

import { useThree } from "@react-three/fiber";
import { useMemo } from "react";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { Line2 } from "three/addons/lines/webgpu/Line2.js";
import { Line2NodeMaterial } from "three/webgpu";

import { getLine2RaycastThreshold } from "./get-line2-raycast-threshold";
import { normalizeScreenSpaceLinePoints } from "./normalize-screen-space-line-points";
import type { ScreenSpaceLineProps } from "./screen-space-line";
import { useRetainedDisposable } from "./use-retained-disposable";

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
  ...objectProps
}: WebGpuScreenSpaceLineProps) {
  const pixelRatio = useThree((state) => state.viewport.dpr);
  const normalizedPoints = useMemo(() => normalizeScreenSpaceLinePoints(points), [points]);
  const resources = useMemo(() => {
    const geometry = new LineGeometry();
    geometry.setPositions(
      normalizedPoints.flatMap((point) => point.toArray()),
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

    const raycastThreshold = getLine2RaycastThreshold(width, hitSlop, pixelRatio);
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

    return {
      dispose() {
        geometry.dispose();
        material.dispose();
      },
      line: object,
    };
  }, [color, depthTest, depthWrite, hitSlop, layer, normalizedPoints, pixelRatio, renderOrder, transparent, width]);
  useRetainedDisposable(resources);

  if (normalizedPoints.length < 2) return null;
  return <primitive dispose={null} object={resources.line} {...objectProps} />;
}
