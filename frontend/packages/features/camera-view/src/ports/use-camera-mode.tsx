"use client";
import { useEditorActions } from "@camera-path/actions";
import { useCameraModeValue } from "@camera-path/store";

export function useCameraMode() {
  const mode = useCameraModeValue();
  const set = useEditorActions().setCameraMode;
  return { cameraMode: mode, setCameraMode: set };
}
