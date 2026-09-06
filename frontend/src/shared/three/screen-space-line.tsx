"use client";

import { useThree, type EventHandlers } from "@react-three/fiber";
import type { ColorRepresentation, Vector3 } from "three";

import { WebGlScreenSpaceLine } from "./webgl-screen-space-line";
import { WebGpuScreenSpaceLine } from "./webgpu-screen-space-line";

export type ScreenSpaceLinePoint = Vector3 | readonly [number, number, number];

export interface ScreenSpaceLineProps extends Pick<
  EventHandlers,
  "onClick" | "onPointerOut" | "onPointerOver"
> {
  color: ColorRepresentation;
  depthTest?: boolean;
  depthWrite?: boolean;
  hitSlop?: number;
  layer?: number;
  points: readonly ScreenSpaceLinePoint[];
  radius?: number;
  renderOrder?: number;
  transparent?: boolean;
  webGpuHitSlop?: number;
  width?: number;
}

export function ScreenSpaceLine(props: ScreenSpaceLineProps) {
  const renderer = useThree((state) => state.gl);
  const isWebGpu = Boolean((renderer as { isWebGPURenderer?: boolean }).isWebGPURenderer);
  const { hitSlop, radius, webGpuHitSlop, width, ...commonProps } = props;
  return isWebGpu
    ? <WebGpuScreenSpaceLine {...commonProps} hitSlop={webGpuHitSlop} width={width} />
    : <WebGlScreenSpaceLine {...commonProps} hitSlop={hitSlop} radius={radius} />;
}
