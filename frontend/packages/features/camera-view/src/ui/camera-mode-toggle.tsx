"use client";
import { Camera, Orbit, Plane } from "lucide-react";
import { useCameraState } from "@camera-path/store";

import { Button } from "@camera-path/ui-kit";

import type { CameraMode } from "@camera-path/types/editor-state";
import { useCameraMode } from "../ports/use-camera-mode";

interface CameraModeToggleProps {
  onModeChange: (mode: CameraMode) => void;
  trajectoryAvailable: boolean;
}

export function CameraModeToggle({
  onModeChange,
  trajectoryAvailable,
}: CameraModeToggleProps) {
  const { cameraMode, setCameraMode } = useCameraMode();
  const { cameraType } = useCameraState();
  const freeFlight = cameraType === "freeFlight";
  const NavigationIcon = freeFlight ? Plane : Orbit;
  const trajectoryMode = cameraMode === "trajectory";
  const label = trajectoryMode
    ? `Return to ${freeFlight ? "free flight" : "orbit"} camera`
    : "View from trajectory camera";
  const nextMode = trajectoryMode ? "orbit" : "trajectory";

  return (
    <Button
      aria-label={label}
      aria-pressed={trajectoryMode}
      className={
        trajectoryMode
          ? "shadow-sm"
          : "bg-background/85 text-foreground shadow-sm backdrop-blur"
      }
      disabled={!trajectoryAvailable && !trajectoryMode}
      onClick={() => {
        onModeChange(nextMode);
        setCameraMode(nextMode);
      }}
      size="sm"
      title={
        trajectoryAvailable
          ? label
          : "Create a trajectory to enable camera view"
      }
      variant={trajectoryMode ? "default" : "outline"}
    >
      {trajectoryMode ? (
        <NavigationIcon className="size-3.5" />
      ) : (
        <Camera className="size-3.5" />
      )}
      {trajectoryMode
        ? freeFlight
          ? "FreeFlight view"
          : "Orbit view"
        : "Camera view"}
    </Button>
  );
}
