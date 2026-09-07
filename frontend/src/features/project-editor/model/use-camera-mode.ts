"use client";

import { useEditorStore } from "./editor-store-provider";

export function useCameraMode() {
  const cameraMode = useEditorStore((store) => store.camera.cameraMode);
  const setCameraMode = useEditorStore((store) => store.cameraActions.setCameraMode);
  return { cameraMode, setCameraMode };
}
