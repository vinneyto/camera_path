"use client";

import { useCallback, useState } from "react";

import type { Anchor } from "@/entities/project";
import { CameraModeToggle, useCameraMode } from "@/features/project-editor";
import { useTheme } from "@/features/theme-switcher";
import { ContextMenu, type ContextMenuPosition } from "@/shared/ui";

import { SceneMessage } from "./scene-message";
import type { SceneViewportFrameProps } from "./scene-viewport-types";

const DARK_BACKGROUND = [12 / 255, 16 / 255, 23 / 255, 1] as const;
const LIGHT_BACKGROUND = [235 / 255, 233 / 255, 229 / 255, 1] as const;

type SurfaceState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; message: string };

export function SceneViewportFrame({
  available,
  onDeleteAnchor,
  renderScene,
  trajectoryAvailable,
  unavailableMessage = "This renderer is unavailable in this browser",
}: SceneViewportFrameProps) {
  const { theme } = useTheme();
  const { cameraMode } = useCameraMode();
  const dark = theme === "dark";
  const [anchorMenu, setAnchorMenu] = useState<(ContextMenuPosition & { anchor: Anchor }) | null>(null);
  const [surfaceState, setSurfaceState] = useState<SurfaceState>({ status: "loading" });
  const handleSurfaceLoading = useCallback(() => setSurfaceState({ status: "loading" }), []);
  const handleSurfaceReady = useCallback(() => setSurfaceState({ status: "ready" }), []);
  const handleSurfaceError = useCallback((error: Error) => {
    setSurfaceState({ status: "error", message: error.message });
  }, []);

  return (
    <div className="relative h-full w-full">
      {available && renderScene({
        background: dark ? DARK_BACKGROUND : LIGHT_BACKGROUND,
        dark,
        onOpenAnchorMenu: (anchor, position) => setAnchorMenu({ ...position, anchor }),
        onSurfaceError: handleSurfaceError,
        onSurfaceLoading: handleSurfaceLoading,
        onSurfaceReady: handleSurfaceReady,
      })}
      {available === false && <SceneMessage message={unavailableMessage} />}
      {available !== false && surfaceState.status === "loading" && (
        <SceneMessage message="Loading mug.ply…" />
      )}
      {available !== false && surfaceState.status === "error" && (
        <SceneMessage message={`Could not load mug.ply: ${surfaceState.message}`} />
      )}
      {available && (
        <div className="absolute right-3 top-3 z-20">
          <CameraModeToggle
            onModeChange={(mode) => {
              if (mode === "trajectory") setAnchorMenu(null);
            }}
            trajectoryAvailable={trajectoryAvailable && surfaceState.status === "ready"}
          />
        </div>
      )}
      {cameraMode === "orbit" && (
        <ContextMenu
          items={anchorMenu ? [{
            destructive: true,
            label: `Delete anchor ${anchorMenu.anchor.label}`,
            onSelect: () => onDeleteAnchor(anchorMenu.anchor),
          }] : []}
          onClose={() => setAnchorMenu(null)}
          position={anchorMenu}
        />
      )}
    </div>
  );
}
