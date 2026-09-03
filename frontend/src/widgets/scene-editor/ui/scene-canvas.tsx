"use client";

import { OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { MapPinPlus } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import type { GaussianCloud as GaussianCloudObject } from "3dgs-tile-webgpu";
import {
  Camera,
  PerspectiveCamera,
  Sphere,
} from "three/webgpu";

import type { Anchor, Vec3 } from "@/entities/project";
import type { CompiledTrajectory } from "@/entities/trajectory";
import {
  AnchorPlacementTool,
  type AnchorPlacement,
} from "@/features/anchor-creation";
import { useEditorStore } from "@/features/project-editor";
import { useTheme } from "@/features/theme-switcher";
import { GaussianCloud, GaussianTile, RenderPipelineCanvas } from "@/shared/three";
import { Button, ContextMenu, type ContextMenuPosition } from "@/shared/ui";

import { AnchorMarker } from "./anchor-marker";
import { PlaybackCamera } from "./playback-camera";
import { TrajectoryLine } from "./trajectory-line";

const DARK_BACKGROUND = [12 / 255, 16 / 255, 23 / 255, 1] as const;
const LIGHT_BACKGROUND = [235 / 255, 233 / 255, 229 / 255, 1] as const;

type CloudState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; message: string };

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
  const surfaceRoot = useRef<GaussianCloudObject>(null);
  const anchorPlacementMode = useEditorStore((state) => state.anchorPlacementMode);
  const anchorPlacementPhase = useEditorStore((state) => state.anchorPlacementPhase);
  const finishAnchorPlacement = useEditorStore((state) => state.finishAnchorPlacement);
  const setAnchorToolPhase = useEditorStore((state) => state.setAnchorPlacementPhase);
  const setAnchorPlacementShiftHeld = useEditorStore((state) => state.setAnchorPlacementShiftHeld);
  const toggleAnchorPlacementPinned = useEditorStore((state) => state.toggleAnchorPlacementPinned);
  const anchorToolActive = anchorPlacementMode !== "inactive" || anchorPlacementPhase === "height";
  const anchorToolPinned = anchorPlacementMode === "pinned";
  const [anchorMenu, setAnchorMenu] = useState<(ContextMenuPosition & { anchor: Anchor }) | null>(null);
  const [cloudState, setCloudState] = useState<CloudState>({ status: "loading" });
  const webGpuAvailable = useSyncExternalStore(
    subscribeToWebGpuAvailability,
    getWebGpuAvailability,
    getServerWebGpuAvailability,
  );
  const completeAnchor = useCallback((placement: AnchorPlacement) => {
    onAddAnchor(placement.surfacePosition, placement.surfaceNormal, placement.lift);
    finishAnchorPlacement();
  }, [finishAnchorPlacement, onAddAnchor]);
  const handleCloudLoading = useCallback(() => setCloudState({ status: "loading" }), []);
  const handleCloudReady = useCallback(() => setCloudState({ status: "ready" }), []);
  const handleCloudError = useCallback((error: Error) => {
    setCloudState({ status: "error", message: error.message });
  }, []);

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
      {webGpuAvailable && (
        <RenderPipelineCanvas
          camera={{ far: 100, fov: 42, near: 0.01, position: [0, 0, 5] }}
          dpr={[1, 2]}
          shadows
        >
          <GaussianTile background={dark ? DARK_BACKGROUND : LIGHT_BACKGROUND}>
            <SceneContents
              anchorToolActive={anchorToolActive}
              anchors={anchors}
              busy={busy}
              completeAnchor={completeAnchor}
              dark={dark}
              finishAnchorPlacement={finishAnchorPlacement}
              onCloudError={handleCloudError}
              onCloudLoading={handleCloudLoading}
              onCloudReady={handleCloudReady}
              onOpenAnchorMenu={(anchor, position) => setAnchorMenu({ ...position, anchor })}
              onSelectTrajectory={onSelectTrajectory}
              pathPosition={pathPosition}
              selected={selected}
              setAnchorToolPhase={setAnchorToolPhase}
              surfaceRoot={surfaceRoot}
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
      <div className="absolute left-3 top-3 z-10">
        <div className="rounded-lg border bg-background/90 p-1 shadow-sm backdrop-blur">
          <Button
            aria-label="Place anchor"
            aria-pressed={anchorToolPinned}
            disabled={busy || !webGpuAvailable || cloudState.status !== "ready"}
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

interface SceneContentsProps {
  anchorToolActive: boolean;
  anchors: Anchor[];
  busy: boolean;
  completeAnchor: (placement: AnchorPlacement) => void;
  dark: boolean;
  finishAnchorPlacement: () => void;
  onCloudError: (error: Error) => void;
  onCloudLoading: () => void;
  onCloudReady: () => void;
  onOpenAnchorMenu: (anchor: Anchor, position: ContextMenuPosition) => void;
  onSelectTrajectory: () => void;
  pathPosition: number;
  selected: boolean;
  setAnchorToolPhase: (phase: "surface" | "height") => void;
  surfaceRoot: RefObject<GaussianCloudObject | null>;
  trajectory: CompiledTrajectory | null;
}

function SceneContents({
  anchorToolActive,
  anchors,
  busy,
  completeAnchor,
  dark,
  finishAnchorPlacement,
  onCloudError,
  onCloudLoading,
  onCloudReady,
  onOpenAnchorMenu,
  onSelectTrajectory,
  pathPosition,
  selected,
  setAnchorToolPhase,
  surfaceRoot,
  trajectory,
}: SceneContentsProps) {
  const camera = useThree((state) => state.camera);
  const [orbitTarget, setOrbitTarget] = useState<Vec3>([0, 0, 0]);
  const handleCloudLoad = useCallback((cloud: GaussianCloudObject) => {
    frameCloud(camera, cloud, setOrbitTarget);
    onCloudReady();
  }, [camera, onCloudReady]);

  return (
    <>
      <GaussianCloud
        cloudRef={surfaceRoot}
        name="Mug Gaussian cloud"
        onError={onCloudError}
        onLoad={handleCloudLoad}
        onLoading={onCloudLoading}
        src="/mug.ply"
      />
      <ambientLight intensity={dark ? 0.8 : 1.25} />
      <directionalLight
        castShadow
        intensity={dark ? 1.7 : 2.1}
        position={[5, 8, 4]}
        shadow-mapSize={[1024, 1024]}
      />
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
          onContextMenu={onOpenAnchorMenu}
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
        maxDistance={Infinity}
        minDistance={0.001}
        target={orbitTarget}
      />
    </>
  );
}

function subscribeToWebGpuAvailability() {
  return () => undefined;
}

function getWebGpuAvailability(): boolean {
  return "gpu" in navigator;
}

function getServerWebGpuAvailability(): null {
  return null;
}

function frameCloud(
  camera: Camera,
  cloud: GaussianCloudObject,
  setOrbitTarget: (target: Vec3) => void,
) {
  if (!(camera instanceof PerspectiveCamera) || cloud.lod === null) return;
  cloud.updateWorldMatrix(true, false);
  const sphere = cloud.lod.octree.bounds.getBoundingSphere(new Sphere());
  sphere.applyMatrix4(cloud.matrixWorld);
  const radius = Math.max(sphere.radius, 0.1);
  camera.near = Math.max(radius / 10_000, 0.0001);
  camera.far = Math.max(radius * 20, 100);
  camera.position.set(
    sphere.center.x + radius * 0.15,
    sphere.center.y + radius * 0.35,
    sphere.center.z + radius * 2.4,
  );
  camera.lookAt(sphere.center);
  camera.updateProjectionMatrix();
  setOrbitTarget(sphere.center.toArray() as Vec3);
}

function SceneMessage({ message }: { message: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background text-xs text-muted-foreground">
      {message}
    </div>
  );
}
