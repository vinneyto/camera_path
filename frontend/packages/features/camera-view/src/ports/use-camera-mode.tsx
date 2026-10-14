"use client";
import { cameraMode } from "@camera-path/contracts/host-data";
import { setCameraMode } from "@camera-path/contracts/host-requests";
import { useData, useRequestAction } from "@camera-path/extension-api";
import { manifest } from "../manifest";
export function useCameraMode() {
  const mode = useData(manifest, cameraMode);
  const set = useRequestAction(manifest, setCameraMode);
  return { cameraMode: mode, setCameraMode: set };
}
