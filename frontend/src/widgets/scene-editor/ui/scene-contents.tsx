import { OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useCallback, useRef, useState } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import type { Anchor, Vec3 } from "@/entities/project";
import type { CompiledTrajectory } from "@/entities/trajectory";
import { getAnchorLabel } from "@/features/anchor-creation";
import { useEditorStore } from "@/features/project-editor";
import {
  SceneSurface,
  SceneSurfaceProvider,
  type SceneSurfaceReady,
  type SceneSurfaceBackground,
  useGaussianRenderingBackend,
} from "@/shared/scene-surface";
import type { ContextMenuPosition } from "@/shared/ui";

import { AnchorMarker } from "./anchor-marker";
import { AnchorPlacementPreview } from "./anchor-placement-preview";
import { frameSurface } from "./frame-surface";
import { PlaybackCamera } from "./playback-camera";
import { TrajectoryLine } from "./trajectory-line";
import { useAnchorPlacement } from "./use-anchor-placement";
import { useStopOrbitControlsInertia } from "./use-stop-orbit-controls-inertia";

const SCENE_SURFACE_SOURCE = { kind: "url", url: "/mug.ply" } as const;

interface SceneContentsProps {
  anchors: Anchor[];
  background: SceneSurfaceBackground;
  dark: boolean;
  onAddAnchor: (position: Vec3, normal: Vec3) => void;
  onSurfaceError: (error: Error) => void;
  onSurfaceLoading: () => void;
  onSurfaceReady: () => void;
  onOpenAnchorMenu: (anchor: Anchor, position: ContextMenuPosition) => void;
  onSelectTrajectory: () => void;
  pathPosition: number;
  selected: boolean;
  trajectory: CompiledTrajectory | null;
}

export function SceneContents({
  anchors,
  background,
  dark,
  onAddAnchor,
  onSurfaceError,
  onSurfaceLoading,
  onSurfaceReady,
  onOpenAnchorMenu,
  onSelectTrajectory,
  pathPosition,
  selected,
  trajectory,
}: SceneContentsProps) {
  const camera = useThree((state) => state.camera);
  const activeTool = useEditorStore((state) => state.activeTool);
  const renderingBackend = useGaussianRenderingBackend(background);
  const placement = useAnchorPlacement({ onPlace: onAddAnchor });
  const orbitControlsRef = useRef<OrbitControlsImpl>(null);
  const [orbitTarget, setOrbitTarget] = useState<Vec3>([0, 0, 0]);
  useStopOrbitControlsInertia(orbitControlsRef, activeTool !== null);
  const handleSurfaceReady = useCallback((surface: SceneSurfaceReady) => {
    frameSurface(camera, surface.bounds, setOrbitTarget);
    onSurfaceReady();
  }, [camera, onSurfaceReady]);

  return (
    <SceneSurfaceProvider backend={renderingBackend}>
      <SceneSurface
        name="Mug Gaussian cloud"
        onError={onSurfaceError}
        onReady={handleSurfaceReady}
        onLoading={onSurfaceLoading}
        onPointerOut={placement.handlePointerOut}
        onPointerCancel={placement.handlePointerCancel}
        onSurfacePointerDown={placement.handlePointerDown}
        onSurfacePointerMove={placement.handlePointerMove}
        onSurfacePointerUp={placement.handlePointerUp}
        source={SCENE_SURFACE_SOURCE}
      />
      <AnchorPlacementPreview
        backend={renderingBackend}
        hit={placement.previewHit}
        label={getAnchorLabel(anchors)}
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
          interactive={activeTool === null}
          onSelect={onSelectTrajectory}
          selected={selected}
          trajectory={trajectory}
        />
      )}
      {trajectory && trajectory.position_segments.length > 0 && (
        <PlaybackCamera pathPosition={pathPosition} trajectory={trajectory} />
      )}
      <OrbitControls
        enabled={activeTool === null}
        makeDefault
        maxDistance={Infinity}
        minDistance={0.001}
        onChange={placement.handleControlsChange}
        ref={orbitControlsRef}
        target={orbitTarget}
      />
    </SceneSurfaceProvider>
  );
}
