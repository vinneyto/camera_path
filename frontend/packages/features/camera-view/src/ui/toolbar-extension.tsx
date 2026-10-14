"use client";
import { compiledTrajectory } from "@camera-path/contracts/host-data";
import { useDataQuery } from "@camera-path/extension-api";
import { useViewportServices } from "@camera-path/scene-runtime/viewport/viewport-provider";
import { manifest } from "../manifest";
import { CameraModeToggle } from "./camera-mode-toggle";
export function ToolbarExtension() {
  const query = useDataQuery(manifest, compiledTrajectory);
  const viewport = useViewportServices();
  return (
    <CameraModeToggle
      trajectoryAvailable={Boolean(query.data?.data.position_segments.length)}
      onModeChange={viewport.closeMenu}
    />
  );
}
