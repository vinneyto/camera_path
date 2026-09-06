"use client";

import { useCallback, useState } from "react";

import type { Anchor, Vec3 } from "@/entities/project";
import type { CompiledTrajectory } from "@/entities/trajectory";
import { useTheme } from "@/features/theme-switcher";
import { GaussianTile, RenderPipelineCanvas } from "@/shared/three";
import { ContextMenu, type ContextMenuPosition } from "@/shared/ui";

import { SceneContents } from "./scene-contents";
import { SceneMessage } from "./scene-message";
import { useWebGpuAvailability } from "./use-webgpu-availability";

const DARK_BACKGROUND = [12 / 255, 16 / 255, 23 / 255, 1] as const;
const LIGHT_BACKGROUND = [235 / 255, 233 / 255, 229 / 255, 1] as const;

type CloudState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; message: string };

interface SceneCanvasProps {
  anchors: Anchor[];
  pathPosition: number;
  selected: boolean;
  trajectory: CompiledTrajectory | null;
  onAddAnchor: (position: Vec3, normal: Vec3) => void;
  onDeleteAnchor: (anchor: Anchor) => void;
  onSelectTrajectory: () => void;
}

export function SceneCanvas({
  anchors,
  pathPosition,
  selected,
  trajectory,
  onAddAnchor,
  onDeleteAnchor,
  onSelectTrajectory,
}: SceneCanvasProps) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const [anchorMenu, setAnchorMenu] = useState<(ContextMenuPosition & { anchor: Anchor }) | null>(null);
  const [cloudState, setCloudState] = useState<CloudState>({ status: "loading" });
  const webGpuAvailable = useWebGpuAvailability();
  const handleCloudLoading = useCallback(() => setCloudState({ status: "loading" }), []);
  const handleCloudReady = useCallback(() => setCloudState({ status: "ready" }), []);
  const handleCloudError = useCallback((error: Error) => {
    setCloudState({ status: "error", message: error.message });
  }, []);

  return (
    <div className="relative h-full w-full">
      {webGpuAvailable && (
        <RenderPipelineCanvas
          camera={{ far: 100, fov: 42, near: 0.01, position: [0, 0, 5] }}
          dpr={[1, 2]}
          shadows
        >
          <GaussianTile background={dark ? DARK_BACKGROUND : LIGHT_BACKGROUND}>
            <SceneContents
              anchors={anchors}
              dark={dark}
              onAddAnchor={onAddAnchor}
              onCloudError={handleCloudError}
              onCloudLoading={handleCloudLoading}
              onCloudReady={handleCloudReady}
              onOpenAnchorMenu={(anchor, position) => setAnchorMenu({ ...position, anchor })}
              onSelectTrajectory={onSelectTrajectory}
              pathPosition={pathPosition}
              selected={selected}
              trajectory={trajectory}
            />
          </GaussianTile>
        </RenderPipelineCanvas>
      )}
      {webGpuAvailable === false && (
        <SceneMessage message="WebGPU is unavailable in this browser" />
      )}
      {webGpuAvailable !== false && cloudState.status === "loading" && (
        <SceneMessage message="Loading mug.ply…" />
      )}
      {webGpuAvailable !== false && cloudState.status === "error" && (
        <SceneMessage message={`Could not load mug.ply: ${cloudState.message}`} />
      )}
      <ContextMenu
        items={anchorMenu ? [{
          destructive: true,
          label: `Delete anchor ${anchorMenu.anchor.label}`,
          onSelect: () => onDeleteAnchor(anchorMenu.anchor),
        }] : []}
        onClose={() => setAnchorMenu(null)}
        position={anchorMenu}
      />
    </div>
  );
}
