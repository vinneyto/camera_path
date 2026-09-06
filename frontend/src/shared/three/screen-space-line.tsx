"use client";

import type { EventHandlers } from "@react-three/fiber";
import type { ColorRepresentation, Vector3 } from "three";

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
  points: readonly ScreenSpaceLinePoint[];
  renderOrder?: number;
  width?: number;
}

export function ScreenSpaceLine(props: ScreenSpaceLineProps) {
  return <WebGpuScreenSpaceLine {...props} />;
}
