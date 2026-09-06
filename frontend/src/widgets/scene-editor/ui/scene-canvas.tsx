"use client";

import { useCallback, useState } from "react";

import type { Anchor, Vec3 } from "@/entities/project";
import type { CompiledTrajectory } from "@/entities/trajectory";
import { useTheme } from "@/features/theme-switcher";
import { SceneSurfaceProvider } from "@/shared/scene-surface";
import { RenderPipelineCanvas } from "@/shared/three";
import { ContextMenu, type ContextMenuPosition } from "@/shared/ui";

import { SceneContents } from "./scene-contents";
import { SceneMessage } from "./scene-message";
import { useWebGpuAvailability } from "./use-webgpu-availability";

const DARK_BACKGROUND = [12 / 255, 16 / 255, 23 / 255, 1] as const;
const LIGHT_BACKGROUND = [235 / 255, 233 / 255, 229 / 255, 1] as const;

type SurfaceState =
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
  const [surfaceState, setSurfaceState] = useState<SurfaceState>({ status: "loading" });
  const webGpuAvailable = useWebGpuAvailability();
  const handleSurfaceLoading = useCallback(() => setSurfaceState({ status: "loading" }), []);
  const handleSurfaceReady = useCallback(() => setSurfaceState({ status: "ready" }), []);
  const handleSurfaceError = useCallback((error: Error) => {
    setSurfaceState({ status: "error", message: error.message });
  }, []);

  return (
    <div className="relative h-full w-full">
      {webGpuAvailable && (
        <RenderPipelineCanvas
          camera={{ far: 100, fov: 42, near: 0.01, position: [0, 0, 5] }}
          dpr={[1, 2]}
          shadows
        >
          <SceneSurfaceProvider background={dark ? DARK_BACKGROUND : LIGHT_BACKGROUND}>
            <SceneContents
              anchors={anchors}
              dark={dark}
              onAddAnchor={onAddAnchor}
              onSurfaceError={handleSurfaceError}
              onSurfaceLoading={handleSurfaceLoading}
              onSurfaceReady={handleSurfaceReady}
              onOpenAnchorMenu={(anchor, position) => setAnchorMenu({ ...position, anchor })}
              onSelectTrajectory={onSelectTrajectory}
              pathPosition={pathPosition}
              selected={selected}
              trajectory={trajectory}
            />
          </SceneSurfaceProvider>
        </RenderPipelineCanvas>
      )}
      {webGpuAvailable === false && (
        <SceneMessage message="WebGPU is unavailable in this browser" />
      )}
      {webGpuAvailable !== false && surfaceState.status === "loading" && (
        <SceneMessage message="Loading mug.ply…" />
      )}
      {webGpuAvailable !== false && surfaceState.status === "error" && (
        <SceneMessage message={`Could not load mug.ply: ${surfaceState.message}`} />
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
