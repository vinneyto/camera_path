"use client";

import { useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { Line2NodeMaterial } from "three/webgpu";

import { createWebGpuScreenSpaceLine } from "./create-webgpu-screen-space-line";
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
  const normalizedPoints = normalizeScreenSpaceLinePoints(points);

  const line = useMemo(() => createWebGpuScreenSpaceLine(), []);
  const lineRef = useRef(line);

  useLayoutEffect(() => {
    if (!lineRef.current) {
      return;
    }

    const geometry = new LineGeometry();
    geometry.setPositions(normalizedPoints.flatMap((point) => point.toArray()));
    lineRef.current.geometry = geometry;

    return () => {
      geometry.dispose();
    };
  }, [normalizedPoints]);

  useLayoutEffect(() => {
    if (!lineRef.current) {
      return;
    }

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
    if (!lineRef.current) {
      return;
    }

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
