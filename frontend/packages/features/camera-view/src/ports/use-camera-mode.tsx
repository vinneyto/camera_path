"use client";
import { useEditorActions } from "@camera-path/actions";
import { useCameraState } from "@camera-path/store";

export function useCameraMode() {
  const mode = useCameraState().cameraMode;
  const set = useEditorActions().setCameraMode;
  return { cameraMode: mode, setCameraMode: set };
}
