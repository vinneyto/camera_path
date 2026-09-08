"use client";

import { useThree } from "@react-three/fiber";
import { useLayoutEffect } from "react";
import type { PerspectiveCamera } from "three";

import { applyCameraViewOffset } from "../lib/apply-camera-view-offset";

interface CameraViewOffsetProps {
  bottomInset: number;
}

export function CameraViewOffset({ bottomInset }: CameraViewOffsetProps) {
  const camera = useThree((state) => state.camera);
  const height = useThree((state) => state.size.height);
  const width = useThree((state) => state.size.width);

  useLayoutEffect(() => {
    if (!("isPerspectiveCamera" in camera) || camera.isPerspectiveCamera !== true) return;

    const perspectiveCamera = camera as PerspectiveCamera;
    applyCameraViewOffset(perspectiveCamera, width, height, bottomInset);
    return () => perspectiveCamera.clearViewOffset();
  }, [bottomInset, camera, height, width]);

  return null;
}
