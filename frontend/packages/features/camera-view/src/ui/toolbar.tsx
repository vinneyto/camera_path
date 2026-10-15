"use client";
import { useCompiledTrajectoryResource } from "@camera-path/api/resources";

import { useViewportServices } from "@camera-path/scene-runtime/viewport/viewport-provider";
import { CameraModeToggle } from "./camera-mode-toggle";
export function CameraViewToolbar() {
  const query = useCompiledTrajectoryResource();
  const viewport = useViewportServices();
  return (
    <CameraModeToggle
      trajectoryAvailable={Boolean(query.data?.data.position_segments.length)}
      onModeChange={viewport.closeMenu}
    />
  );
}
