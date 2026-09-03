"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { MapPinPlus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Group } from "three";

import type { Anchor, Vec3 } from "@/entities/project";
import type { CompiledTrajectory } from "@/entities/trajectory";
import {
  AnchorPlacementTool,
  type AnchorPlacement,
} from "@/features/anchor-creation";
import { useEditorStore } from "@/features/project-editor";
import { useTheme } from "@/features/theme-switcher";
import { Button, ContextMenu, type ContextMenuPosition } from "@/shared/ui";

import { AnchorMarker } from "./anchor-marker";
import { PlaybackCamera } from "./playback-camera";
import { SimpleScene } from "./simple-scene";
import { TrajectoryLine } from "./trajectory-line";

interface SceneCanvasProps {
  anchors: Anchor[];
  busy: boolean;
  pathPosition: number;
  selected: boolean;
  trajectory: CompiledTrajectory | null;
  onAddAnchor: (position: Vec3, normal: Vec3, lift: number) => void;
  onDeleteAnchor: (anchor: Anchor) => void;
  onSelectTrajectory: () => void;
}

export function SceneCanvas({
  anchors,
  busy,
  pathPosition,
  selected,
  trajectory,
  onAddAnchor,
  onDeleteAnchor,
  onSelectTrajectory,
}: SceneCanvasProps) {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const surfaceRoot = useRef<Group>(null);
  const anchorPlacementMode = useEditorStore((state) => state.anchorPlacementMode);
  const finishAnchorPlacement = useEditorStore((state) => state.finishAnchorPlacement);
  const setAnchorToolPhase = useEditorStore((state) => state.setAnchorPlacementPhase);
  const setAnchorPlacementShiftHeld = useEditorStore((state) => state.setAnchorPlacementShiftHeld);
  const toggleAnchorPlacementPinned = useEditorStore((state) => state.toggleAnchorPlacementPinned);
  const anchorToolActive = anchorPlacementMode !== "inactive";
  const anchorToolPinned = anchorPlacementMode === "pinned";
  const [anchorMenu, setAnchorMenu] = useState<(ContextMenuPosition & { anchor: Anchor }) | null>(null);
  const completeAnchor = useCallback((placement: AnchorPlacement) => {
    onAddAnchor(placement.surfacePosition, placement.surfaceNormal, placement.lift);
    finishAnchorPlacement();
  }, [finishAnchorPlacement, onAddAnchor]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target;
      const editing = target instanceof HTMLElement
        && (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA");
      if (event.key === "Shift" && !event.repeat && !editing) {
        setAnchorPlacementShiftHeld(true);
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.key === "Shift") setAnchorPlacementShiftHeld(false);
    }

    function handleBlur() {
      setAnchorPlacementShiftHeld(false);
    }

    window.addEventListener("blur", handleBlur);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [setAnchorPlacementShiftHeld]);

  return (
    <div className="relative h-full w-full">
      <Canvas
        camera={{ far: 100, fov: 42, near: 0.05, position: [7, 6, 8] }}
        dpr={[1, 2]}
        shadows
      >
        <color args={[dark ? "#0c1017" : "#ebe9e5"]} attach="background" />
        <ambientLight intensity={dark ? 0.8 : 1.25} />
        <directionalLight castShadow intensity={dark ? 1.7 : 2.1} position={[5, 8, 4]} shadow-mapSize={[1024, 1024]} />
        <SimpleScene dark={dark} ref={surfaceRoot} />
        {anchorToolActive && (
          <AnchorPlacementTool
            color={dark ? "#f8fafc" : "#111827"}
            disabled={busy}
            onCancel={finishAnchorPlacement}
            onComplete={completeAnchor}
            onPhaseChange={setAnchorToolPhase}
            surfaceRoot={surfaceRoot}
          />
        )}
        {anchors.map((anchor) => (
          <AnchorMarker
            anchor={anchor}
            interactive={!anchorToolActive}
            key={anchor.id}
            onContextMenu={(selectedAnchor, position) => setAnchorMenu({ ...position, anchor: selectedAnchor })}
          />
        ))}
        {trajectory && (
          <TrajectoryLine
            dark={dark}
            interactive={!anchorToolActive}
            onSelect={onSelectTrajectory}
            selected={selected}
            trajectory={trajectory}
          />
        )}
        {trajectory && trajectory.position_segments.length > 0 && (
          <PlaybackCamera pathPosition={pathPosition} trajectory={trajectory} />
        )}
        <OrbitControls
          enabled={!anchorToolActive}
          makeDefault
          maxDistance={18}
          minDistance={2.5}
          target={[0, 0.7, 0]}
        />
      </Canvas>
      <div className="absolute left-3 top-3 z-10">
        <div className="rounded-lg border bg-background/90 p-1 shadow-sm backdrop-blur">
          <Button
            aria-label="Place anchor"
            aria-pressed={anchorToolPinned}
            disabled={busy}
            onClick={toggleAnchorPlacementPinned}
            size="sm"
            title="Place anchor (hold Shift)"
            variant={anchorToolActive ? "default" : "ghost"}
          >
            <MapPinPlus className="size-3.5" />
            Anchor
          </Button>
        </div>
      </div>
      <ContextMenu
        items={anchorMenu && !anchorToolActive ? [{
          destructive: true,
          label: `Delete anchor ${anchorMenu.anchor.label}`,
          onSelect: () => onDeleteAnchor(anchorMenu.anchor),
        }] : []}
        onClose={() => setAnchorMenu(null)}
        position={anchorToolActive ? null : anchorMenu}
      />
    </div>
  );
}
