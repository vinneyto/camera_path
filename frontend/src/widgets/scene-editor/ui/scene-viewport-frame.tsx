"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import type { Anchor } from "@/entities/project";
import { useTheme } from "@/features/theme-switcher";
import { ContextMenu, type ContextMenuPosition } from "@/shared/ui";

import { SceneMessage } from "./scene-message";
import type {
  SceneViewportFrameContextValue,
  SceneViewportFrameProps,
} from "./scene-viewport-types";

const DARK_BACKGROUND = [12 / 255, 16 / 255, 23 / 255, 1] as const;
const LIGHT_BACKGROUND = [235 / 255, 233 / 255, 229 / 255, 1] as const;

type SurfaceState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; message: string };

const SceneViewportFrameContext = createContext<SceneViewportFrameContextValue | null>(null);

export function SceneViewportFrame({
  available,
  children,
  onDeleteAnchor,
  unavailableMessage = "This renderer is unavailable in this browser",
}: SceneViewportFrameProps) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const [anchorMenu, setAnchorMenu] = useState<(ContextMenuPosition & { anchor: Anchor }) | null>(null);
  const [surfaceState, setSurfaceState] = useState<SurfaceState>({ status: "loading" });
  const handleSurfaceLoading = useCallback(() => setSurfaceState({ status: "loading" }), []);
  const handleSurfaceReady = useCallback(() => setSurfaceState({ status: "ready" }), []);
  const handleSurfaceError = useCallback((error: Error) => {
    setSurfaceState({ status: "error", message: error.message });
  }, []);
  const handleOpenAnchorMenu = useCallback((anchor: Anchor, position: ContextMenuPosition) => {
    setAnchorMenu({ ...position, anchor });
  }, []);
  const context = useMemo<SceneViewportFrameContextValue>(() => ({
    background: dark ? DARK_BACKGROUND : LIGHT_BACKGROUND,
    dark,
    onOpenAnchorMenu: handleOpenAnchorMenu,
    onSurfaceError: handleSurfaceError,
    onSurfaceLoading: handleSurfaceLoading,
    onSurfaceReady: handleSurfaceReady,
  }), [dark, handleOpenAnchorMenu, handleSurfaceError, handleSurfaceLoading, handleSurfaceReady]);

  return (
    <SceneViewportFrameContext.Provider value={context}>
      <div className="relative h-full w-full">
        {available && children}
        {available === false && <SceneMessage message={unavailableMessage} />}
        {available !== false && surfaceState.status === "loading" && (
          <SceneMessage message="Loading mug.ply…" />
        )}
        {available !== false && surfaceState.status === "error" && (
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
    </SceneViewportFrameContext.Provider>
  );
}

export function useSceneViewportFrame(): SceneViewportFrameContextValue {
  const context = useContext(SceneViewportFrameContext);
  if (context === null) {
    throw new Error("useSceneViewportFrame must be used inside SceneViewportFrame");
  }
  return context;
}
