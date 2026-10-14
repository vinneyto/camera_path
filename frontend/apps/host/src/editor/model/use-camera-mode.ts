"use client";
import { useEditorStore } from "@host/editor/model/editor-store-provider";

export function useCameraMode() {
  const cameraMode = useEditorStore((store) => store.camera.cameraMode);
  const setCameraMode = useEditorStore(
    (store) => store.cameraActions.setCameraMode,
  );
  return { cameraMode, setCameraMode };
}
