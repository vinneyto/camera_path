"use client";
import type { SceneSurfaceProps } from "../surface";
import { useViewportServices } from "./viewport-provider";
export function useSurfaceEvents(): Pick<
  SceneSurfaceProps,
  | "onSurfacePointerDown"
  | "onSurfacePointerMove"
  | "onSurfacePointerUp"
  | "onPointerOut"
  | "onPointerCancel"
> {
  const { events } = useViewportServices();
  return {
    onSurfacePointerDown: (hit, event) =>
      events.emit("surfacePointerDown", { hit, event }),
    onSurfacePointerMove: (hit, event) =>
      events.emit("surfacePointerMove", { hit, event }),
    onSurfacePointerUp: (hit, event) =>
      events.emit("surfacePointerUp", { hit, event }),
    onPointerOut: () => events.emit("surfacePointerOut", undefined),
    onPointerCancel: (event) => events.emit("surfacePointerCancel", event),
  };
}
