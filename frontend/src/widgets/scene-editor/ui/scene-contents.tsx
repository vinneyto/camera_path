import { OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useCallback, useEffect, useRef, useState } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import type { Anchor, Vec3 } from "@/entities/project";
import type { CompiledTrajectory } from "@/entities/trajectory";
import { getAnchorLabel } from "@/features/anchor-creation";
import { useGaussianRenderingSettingsStore } from "@/features/gaussian-rendering-settings";
import {
  useActiveEditorTool,
  useCameraMode,
  useEditorHoverCursor,
} from "@/features/project-editor";
import {
  SceneSurface,
  SceneSurfaceProvider,
  type SceneSurfaceReady,
  type SceneSurfaceBackground,
  useGaussianRenderingBackend,
} from "@/shared/scene-surface";
import type { ContextMenuPosition } from "@/shared/ui";

import { AnchorMarker } from "./anchor-marker";
import { AnchorHeightEditingOverlay } from "./anchor-height-editing-overlay";
import { AnchorPlacementPreview } from "./anchor-placement-preview";
import { frameSurface } from "./frame-surface";
import { PlaybackCamera } from "./playback-camera";
import { TrajectoryLine } from "./trajectory-line";
import { TrajectoryCameraControl } from "./trajectory-camera-control";
import { useAnchorPlacement } from "./use-anchor-placement";
import { useAnchorHeightEditing } from "./use-anchor-height-editing";
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
  onUpdateAnchorLift: (anchorId: string, lift: number) => Promise<void>;
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
  onUpdateAnchorLift,
  onOpenAnchorMenu,
  onSelectTrajectory,
  pathPosition,
  selected,
  trajectory,
}: SceneContentsProps) {
  const camera = useThree((state) => state.camera);
  const activeTool = useActiveEditorTool();
  const { cameraMode, setCameraMode } = useCameraMode();
  useEditorHoverCursor();
  const gaussianDprMode = useGaussianRenderingSettingsStore(
    (state) => state.dprMode,
  );
  const renderingBackend = useGaussianRenderingBackend(
    background,
    gaussianDprMode,
  );
  const placement = useAnchorPlacement({ onPlace: onAddAnchor });
  const heightEditing = useAnchorHeightEditing({ anchors, onCommit: onUpdateAnchorLift });
  const orbitControlsRef = useRef<OrbitControlsImpl>(null);
  const [orbitTarget, setOrbitTarget] = useState<Vec3>([0, 0, 0]);
  const trajectoryAvailable = Boolean(trajectory?.position_segments.length);
  useStopOrbitControlsInertia(orbitControlsRef, cameraMode === "orbit" && activeTool !== null);

  useEffect(() => {
    if (cameraMode === "trajectory" && !trajectoryAvailable) setCameraMode("orbit");
  }, [cameraMode, setCameraMode, trajectoryAvailable]);

  useEffect(() => {
    renderingBackend.invalidate();
  }, [anchors, renderingBackend]);

  const handleSurfaceReady = useCallback((surface: SceneSurfaceReady) => {
    frameSurface(camera, surface.bounds, setOrbitTarget);
    onSurfaceReady();
  }, [camera, onSurfaceReady]);
  const handleOrbitEnd = useCallback(() => {
    const controls = orbitControlsRef.current;
    if (controls !== null) setOrbitTarget(controls.target.toArray() as Vec3);
  }, []);
  const editorVisible = cameraMode === "orbit";
  // Equal projected depths share a z-index, so stable DOM order is the tie-breaker.
  const orderedAnchors = [...anchors].sort((left, right) => left.id.localeCompare(right.id));

  return (
    <SceneSurfaceProvider backend={renderingBackend}>
      <SceneSurface
        name="Mug Gaussian cloud"
        onError={onSurfaceError}
        onReady={handleSurfaceReady}
        onLoading={onSurfaceLoading}
        {...(editorVisible ? placement.surfaceEventProps : {})}
        source={SCENE_SURFACE_SOURCE}
      />
      <ambientLight intensity={dark ? 0.8 : 1.25} />
      <directionalLight
        castShadow
        intensity={dark ? 1.7 : 2.1}
        position={[5, 8, 4]}
        shadow-mapSize={[1024, 1024]}
      />
      {editorVisible && placement.previewHit !== null && (
        <AnchorPlacementPreview
          backend={renderingBackend}
          hit={placement.previewHit}
          label={getAnchorLabel(anchors)}
        />
      )}
      {editorVisible && orderedAnchors.map((anchor) => {
        const markerAnchor = heightEditing.preview?.anchorId === anchor.id
          ? { ...anchor, lift: heightEditing.preview.lift, lift_axis: "world_up" as const }
          : anchor;
        return (
          <AnchorMarker
            anchor={markerAnchor}
            hovered={heightEditing.hoveredAnchorId === anchor.id}
            key={anchor.id}
            {...heightEditing.getAnchorInteractionProps(anchor)}
            onContextMenu={(event) => {
              event.stopPropagation();
              event.nativeEvent.preventDefault();
              onOpenAnchorMenu(anchor, {
                x: event.nativeEvent.clientX,
                y: event.nativeEvent.clientY,
              });
            }}
          />
        );
      })}
      {editorVisible && heightEditing.activeAnchor !== null && (
        <AnchorHeightEditingOverlay
          anchor={heightEditing.activeAnchor}
          backend={renderingBackend}
          dragging={heightEditing.preview?.dragging ?? false}
          lift={heightEditing.preview?.lift ?? heightEditing.activeAnchor.lift}
        />
      )}
      {editorVisible && trajectory && (
        <TrajectoryLine
          dark={dark}
          interactive={activeTool === null}
          onSelect={onSelectTrajectory}
          selected={selected}
          trajectory={trajectory}
        />
      )}
      {editorVisible && trajectoryAvailable && trajectory && (
        <PlaybackCamera pathPosition={pathPosition} trajectory={trajectory} />
      )}
      {cameraMode === "orbit" ? (
        <OrbitControls
          enabled={activeTool === null}
          makeDefault
          maxDistance={Infinity}
          minDistance={0.001}
          onChange={placement.handleControlsChange}
          onEnd={handleOrbitEnd}
          ref={orbitControlsRef}
          target={orbitTarget}
        />
      ) : trajectoryAvailable && trajectory ? (
        <TrajectoryCameraControl pathPosition={pathPosition} trajectory={trajectory} />
      ) : null}
    </SceneSurfaceProvider>
  );
}
