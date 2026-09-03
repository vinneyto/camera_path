"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { MapPinPlus } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import type { Group } from "three";

import type { Anchor, Vec3 } from "@/entities/project";
import type { CompiledTrajectory } from "@/entities/trajectory";
import {
  AnchorPlacementTool,
  type AnchorPlacement,
  type AnchorPlacementPhase,
} from "@/features/anchor-creation";
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
  const [anchorToolActive, setAnchorToolActive] = useState(false);
  const [anchorToolPhase, setAnchorToolPhase] = useState<AnchorPlacementPhase>("surface");
  const [anchorMenu, setAnchorMenu] = useState<(ContextMenuPosition & { anchor: Anchor }) | null>(null);
  const completeAnchor = useCallback((placement: AnchorPlacement) => {
    onAddAnchor(placement.surfacePosition, placement.surfaceNormal, placement.lift);
  }, [onAddAnchor]);

  const instruction = !anchorToolActive
    ? "Select the anchor tool to place a point"
    : anchorToolPhase === "surface"
      ? "Click a surface to set the anchor base"
      : "Move vertically and click to set height · Esc to cancel";

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
            onComplete={completeAnchor}
            onPhaseChange={setAnchorToolPhase}
            surfaceRoot={surfaceRoot}
          />
        )}
        {anchors.map((anchor) => (
          <AnchorMarker
            anchor={anchor}
            key={anchor.id}
            onContextMenu={(selectedAnchor, position) => setAnchorMenu({ ...position, anchor: selectedAnchor })}
          />
        ))}
        {trajectory && (
          <TrajectoryLine
            dark={dark}
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
      <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-lg border bg-background/90 p-1 shadow-sm backdrop-blur">
        <Button
          aria-label="Place anchor"
          aria-pressed={anchorToolActive}
          disabled={busy}
          onClick={() => {
            setAnchorToolActive((active) => !active);
            setAnchorToolPhase("surface");
          }}
          size="sm"
          title="Place anchor"
          variant={anchorToolActive ? "default" : "ghost"}
        >
          <MapPinPlus className="size-3.5" />
          Anchor
        </Button>
      </div>
      <div className="pointer-events-none absolute left-3 top-3 rounded-md border bg-background/85 px-2 py-1 text-[10px] text-muted-foreground shadow-sm backdrop-blur">
        {instruction}
      </div>
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
