"use client";
import { useCameraState, useEditorTool } from "@camera-path/store";

export function FreeFlightHint() {
  const { cameraMode, cameraType } = useCameraState();
  const { activeTool } = useEditorTool();
  if (
    cameraMode !== "orbit" ||
    cameraType !== "freeFlight" ||
    activeTool !== null
  )
    return null;
  return (
    <p className="pointer-events-none max-w-48 rounded bg-background/90 px-2 py-1 text-xs sm:max-w-none">
      Click scene to fly · WASD / arrows · Right drag to look · Wheel to fly
    </p>
  );
}
