"use client";

import { useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { Line2 } from "three/addons/lines/webgpu/Line2.js";
import { Line2NodeMaterial } from "three/webgpu";

import { getLine2RaycastThreshold } from "./get-line2-raycast-threshold";
import { normalizeScreenSpaceLinePoints } from "./normalize-screen-space-line-points";
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
  ...objectProps
}: WebGpuScreenSpaceLineProps) {
  const pixelRatio = useThree((state) => state.viewport.dpr);
  const normalizedPoints = useMemo(
    () => normalizeScreenSpaceLinePoints(points),
    [points],
  );
  const line = useMemo(() => {
    const object = new Line2() as Line2 & { raycastThreshold: number };
    object.raycastThreshold = 0;
    const raycast = object.raycast.bind(object);
    object.raycast = (raycaster, intersections) => {
      const previous = raycaster.params.Line2;
      raycaster.params.Line2 = { threshold: object.raycastThreshold };
      try {
        raycast(raycaster, intersections);
      } finally {
        raycaster.params.Line2 = previous;
      }
    };
    return object;
  }, []);
  const lineRef = useRef(line);

  useLayoutEffect(() => {
    const geometry = new LineGeometry();
    geometry.setPositions(normalizedPoints.flatMap((point) => point.toArray()));
    lineRef.current.geometry = geometry;

    return () => {
      geometry.dispose();
    };
  }, [normalizedPoints]);

  useLayoutEffect(() => {
    const material = new Line2NodeMaterial({
      color,
      depthTest,
      depthWrite,
      linewidth: width,
      toneMapped: false,
      transparent,
      worldUnits: false,
    });
    lineRef.current.material = material;

    return () => {
      material.dispose();
    };
  }, [color, depthTest, depthWrite, transparent, width]);

  useLayoutEffect(() => {
    lineRef.current.layers.set(layer);
    lineRef.current.renderOrder = renderOrder;
    lineRef.current.raycastThreshold = getLine2RaycastThreshold(
      width,
      hitSlop,
      pixelRatio,
    );
  }, [hitSlop, layer, pixelRatio, renderOrder, width]);

  if (normalizedPoints.length < 2) return null;
  return <primitive dispose={null} object={line} {...objectProps} />;
}
