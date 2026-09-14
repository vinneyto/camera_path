"use client";

import { useState } from "react";

import type { Anchor } from "@/entities/project";
import { CameraModeToggle, useCameraMode } from "@/features/project-editor";
import { useTheme } from "@/features/theme-switcher";
import {
  ContextMenu,
  FLOATING_UI_Z_INDEX_MIN,
  type ContextMenuPosition,
} from "@/shared/ui";

import { SceneMessage } from "./scene-message";
import type { SceneViewportFrameProps } from "./scene-viewport-types";

const DARK_BACKGROUND = [12 / 255, 16 / 255, 23 / 255, 1] as const;
const LIGHT_BACKGROUND = [235 / 255, 233 / 255, 229 / 255, 1] as const;

type SurfaceState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; message: string };

type SceneContextMenu =
  | (ContextMenuPosition & { anchor: Anchor; type: "anchor" })
  | (ContextMenuPosition & { type: "trajectory" });

export function SceneViewportFrame({
  available,
  deletingTrajectory,
  onDeleteAnchor,
  onDeleteTrajectory,
  renderScene,
  trajectoryAvailable,
  unavailableMessage = "This renderer is unavailable in this browser",
}: SceneViewportFrameProps) {
  const { theme } = useTheme();
  const { cameraMode } = useCameraMode();
  const dark = theme === "dark";
  const [contextMenu, setContextMenu] = useState<SceneContextMenu | null>(null);
  const [surfaceState, setSurfaceState] = useState<SurfaceState>({
    status: "loading",
  });
  function handleSurfaceLoading() {
    setSurfaceState({ status: "loading" });
  }

  function handleSurfaceReady() {
    setSurfaceState({ status: "ready" });
  }

  function handleSurfaceError(error: Error) {
    setSurfaceState({ status: "error", message: error.message });
  }

  return (
    <div className="relative h-full w-full">
      {available &&
        renderScene({
          background: dark ? DARK_BACKGROUND : LIGHT_BACKGROUND,
          dark,
          onOpenAnchorMenu: (anchor, position) =>
            setContextMenu({ ...position, anchor, type: "anchor" }),
          onOpenTrajectoryMenu: (position) =>
            setContextMenu({ ...position, type: "trajectory" }),
          onSurfaceError: handleSurfaceError,
          onSurfaceLoading: handleSurfaceLoading,
          onSurfaceReady: handleSurfaceReady,
        })}
      {available === false && <SceneMessage message={unavailableMessage} />}
      {available !== false && surfaceState.status === "loading" && (
        <SceneMessage message="Loading mug.ply…" />
      )}
      {available !== false && surfaceState.status === "error" && (
        <SceneMessage
          message={`Could not load mug.ply: ${surfaceState.message}`}
        />
      )}
      {available && (
        <div
          className="absolute right-3 top-3"
          style={{ zIndex: FLOATING_UI_Z_INDEX_MIN }}
        >
          <CameraModeToggle
            onModeChange={(mode) => {
              if (mode === "trajectory") {
                setContextMenu(null);
              }
            }}
            trajectoryAvailable={
              trajectoryAvailable && surfaceState.status === "ready"
            }
          />
        </div>
      )}
      {cameraMode === "orbit" && (
        <ContextMenu
          items={
            contextMenu?.type === "anchor"
              ? [
                  {
                    destructive: true,
                    label: `Delete anchor ${contextMenu.anchor.label}`,
                    onSelect: () => onDeleteAnchor(contextMenu.anchor),
                  },
                ]
              : contextMenu?.type === "trajectory"
                ? [
                    {
                      destructive: true,
                      disabled: deletingTrajectory,
                      label: "Delete trajectory",
                      onSelect: onDeleteTrajectory,
                    },
                  ]
                : []
          }
          onClose={() => setContextMenu(null)}
          position={contextMenu}
        />
      )}
    </div>
  );
}
