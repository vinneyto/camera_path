"use client";

import { Camera, Orbit } from "lucide-react";

import { Button } from "@/shared/ui";

import type { CameraMode } from "../model/editor-store";
import { useCameraMode } from "../model/use-camera-mode";

interface CameraModeToggleProps {
  onModeChange: (mode: CameraMode) => void;
  trajectoryAvailable: boolean;
}

export function CameraModeToggle({
  onModeChange,
  trajectoryAvailable,
}: CameraModeToggleProps) {
  const { cameraMode, setCameraMode } = useCameraMode();
  const trajectoryMode = cameraMode === "trajectory";
  const label = trajectoryMode
    ? "Return to orbit camera"
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
        <Orbit className="size-3.5" />
      ) : (
        <Camera className="size-3.5" />
      )}
      {trajectoryMode ? "Orbit view" : "Camera view"}
    </Button>
  );
}
