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
  clouds,
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
  const [surfaceStates, setSurfaceStates] = useState<
    Record<string, SurfaceState>
  >({});
  function handleSurfaceLoading(id: string) {
    setSurfaceStates((states) => ({ ...states, [id]: { status: "loading" } }));
  }

  function handleSurfaceReady(id: string) {
    setSurfaceStates((states) => ({ ...states, [id]: { status: "ready" } }));
  }

  function handleSurfaceError(id: string, error: Error) {
    setSurfaceStates((states) => ({
      ...states,
      [id]: { status: "error", message: error.message },
    }));
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
      {available !== false && clouds.length > 0 && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 space-y-1">
          {clouds.map((cloud) => {
            const state = surfaceStates[cloud.id];
            if (state?.status === "ready") return null;
            return (
              <p
                className="rounded bg-background/90 px-2 py-1 text-xs"
                key={cloud.id}
                role={state?.status === "error" ? "alert" : "status"}
              >
                {cloud.name}:{" "}
                {state?.status === "error" ? state.message : "Loading…"}
              </p>
            );
          })}
        </div>
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
            trajectoryAvailable={trajectoryAvailable}
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
