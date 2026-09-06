"use client";

import { OrbitControls } from "@react-three/drei";
import { type ThreeEvent, useThree } from "@react-three/fiber";
import { useCallback, useState, useSyncExternalStore } from "react";
import type { GaussianCloud as GaussianCloudObject } from "3dgs-tile-webgpu";
import { Camera, PerspectiveCamera, Sphere } from "three/webgpu";

import type { Anchor, Vec3 } from "@/entities/project";
import type { CompiledTrajectory } from "@/entities/trajectory";
import { useTheme } from "@/features/theme-switcher";
import { GaussianCloud, GaussianTile, RenderPipelineCanvas } from "@/shared/three";
import { ContextMenu, type ContextMenuPosition } from "@/shared/ui";

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
  const webGpuAvailable = useSyncExternalStore(
    subscribeToWebGpuAvailability,
    getWebGpuAvailability,
    getServerWebGpuAvailability,
  );
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

interface SceneContentsProps {
  anchors: Anchor[];
  dark: boolean;
  onAddAnchor: (position: Vec3, normal: Vec3) => void;
  onCloudError: (error: Error) => void;
  onCloudLoading: () => void;
  onCloudReady: () => void;
  onOpenAnchorMenu: (anchor: Anchor, position: ContextMenuPosition) => void;
  onSelectTrajectory: () => void;
  pathPosition: number;
  selected: boolean;
  trajectory: CompiledTrajectory | null;
}

function SceneContents({
  anchors,
  dark,
  onAddAnchor,
  onCloudError,
  onCloudLoading,
  onCloudReady,
  onOpenAnchorMenu,
  onSelectTrajectory,
  pathPosition,
  selected,
  trajectory,
}: SceneContentsProps) {
  const camera = useThree((state) => state.camera);
  const [orbitTarget, setOrbitTarget] = useState<Vec3>([0, 0, 0]);
  const handleCloudLoad = useCallback((cloud: GaussianCloudObject) => {
    frameCloud(camera, cloud, setOrbitTarget);
    onCloudReady();
  }, [camera, onCloudReady]);

  function handleCloudClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    const normal = event.face?.normal.clone().transformDirection(event.object.matrixWorld).normalize()
      ?? event.ray.direction.clone().negate().normalize();
    onAddAnchor(event.point.toArray() as Vec3, normal.toArray() as Vec3);
  }

  return (
    <>
      <GaussianCloud
        name="Mug Gaussian cloud"
        onClick={handleCloudClick}
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
      {anchors.map((anchor) => (
        <AnchorMarker anchor={anchor} key={anchor.id} onContextMenu={onOpenAnchorMenu} />
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
      <OrbitControls makeDefault maxDistance={Infinity} minDistance={0.001} target={orbitTarget} />
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

function frameCloud(camera: Camera, cloud: GaussianCloudObject, setOrbitTarget: (target: Vec3) => void) {
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
