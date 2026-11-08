"use client";
import { useCompiledTrajectoryResource } from "@camera-path/api/resources";

import { useViewportServices } from "@camera-path/scene-runtime/viewport/viewport-provider";
import { CameraModeToggle } from "./camera-mode-toggle";
import { CameraTypeToggle } from "./camera-type-toggle";
export function CameraViewToolbar() {
  const query = useCompiledTrajectoryResource();
  const viewport = useViewportServices();
  return (
    <div className="flex items-center gap-2">
      <CameraTypeToggle />
      <CameraModeToggle
        trajectoryAvailable={Boolean(query.data?.data.position_segments.length)}
        onModeChange={viewport.closeMenu}
      />
    </div>
  );
}
