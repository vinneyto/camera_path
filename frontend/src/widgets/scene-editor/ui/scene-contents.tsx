import { OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import type { Anchor, Vec3 } from "@/entities/project";
import type { ProjectCloud } from "@/shared/api/generated/model";
import {
  evaluateDepthOfFieldKeyframe,
  type CompiledTrajectory,
} from "@/entities/trajectory";
import { getAnchorLabel } from "@/features/anchor-creation";
import { useGaussianRenderingSettingsStore } from "@/features/gaussian-rendering-settings";
import {
  useActiveEditorTool,
  useCloudPlacement,
  useCameraMode,
  useEditorHoverCursor,
} from "@/features/project-editor";
import {
  SceneSurfaceProvider,
  type SceneSurfaceReady,
  type SceneSurfaceBackground,
  useGaussianRenderingBackend,
} from "@/shared/scene-surface";
import { DEPTH_OF_FIELD_AUTOFOCUS_LAYER, DepthOfField } from "@/shared/three";
import type { ContextMenuPosition } from "@/shared/ui";

import { AnchorMarker } from "./anchor-marker";
import { AnchorHeightEditingOverlay } from "./anchor-height-editing-overlay";
import { AnchorPlacementPreview } from "./anchor-placement-preview";
import { CloudPlacementPreview } from "./cloud-placement-preview";
import { DepthOfFieldFocusHelper } from "./depth-of-field-focus-helper";
import { frameSurface } from "./frame-surface";
import { isGaussianSurfacePickActive } from "../lib/is-gaussian-surface-pick-active";
import { PlaybackCamera } from "./playback-camera";
import { ProjectCloudSurface } from "./project-cloud-surface";
import { TrajectoryLine } from "./trajectory-line";
import { TrajectoryCameraControl } from "./trajectory-camera-control";
import { useAnchorPlacement } from "./use-anchor-placement";
import { useCloudPlacementInteraction } from "./use-cloud-placement-interaction";
import { useAnchorHeightEditing } from "./use-anchor-height-editing";
import { useStopOrbitControlsInertia } from "./use-stop-orbit-controls-inertia";

const GAUSSIAN_CLOUD_LAYERS = [DEPTH_OF_FIELD_AUTOFOCUS_LAYER] as const;

interface SceneContentsProps {
  anchors: Anchor[];
  clouds: ProjectCloud[];
  background: SceneSurfaceBackground;
  dark: boolean;
  depthOfFieldSupported?: boolean;
  onAddAnchor: (position: Vec3, normal: Vec3) => void;
  onAddCloud: (assetId: string, position: Vec3) => void;
  onSurfaceError: (cloudId: string, error: Error) => void;
  onSurfaceLoading: (cloudId: string) => void;
  onSurfaceReady: (cloudId: string) => void;
  onUpdateAnchorLift: (anchorId: string, lift: number) => Promise<void>;
  onOpenAnchorMenu: (anchor: Anchor, position: ContextMenuPosition) => void;
  onOpenTrajectoryMenu: (position: ContextMenuPosition) => void;
  onSelectTrajectory: () => void;
  pathPosition: number;
  selected: boolean;
  trajectory: CompiledTrajectory | null;
}

export function SceneContents({
  anchors,
  clouds,
  background,
  dark,
  depthOfFieldSupported = false,
  onAddAnchor,
  onAddCloud,
  onSurfaceError,
  onSurfaceLoading,
  onSurfaceReady,
  onUpdateAnchorLift,
  onOpenAnchorMenu,
  onOpenTrajectoryMenu,
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
  const depthOfFieldKeyframe = trajectory
    ? evaluateDepthOfFieldKeyframe(trajectory, pathPosition)
    : null;
  const depthOfFieldFocus = depthOfFieldKeyframe?.focus ?? null;
  const depthOfFieldTimelinePresent = Boolean(
    trajectory?.camera_track.depth_of_field_keyframes.length,
  );
  const depthOfFieldEnabled =
    depthOfFieldSupported &&
    cameraMode === "trajectory" &&
    depthOfFieldTimelinePresent;
  const renderingBackend = useGaussianRenderingBackend(
    background,
    gaussianDprMode,
    depthOfFieldEnabled,
    GAUSSIAN_CLOUD_LAYERS,
  );
  const placement = useAnchorPlacement({ onPlace: onAddAnchor });
  const cloudPlacement = useCloudPlacementInteraction({ onPlace: onAddCloud });
  const { pendingCloud } = useCloudPlacement();
  const heightEditing = useAnchorHeightEditing({
    anchors,
    onCommit: onUpdateAnchorLift,
  });
  const orbitControlsRef = useRef<OrbitControlsImpl>(null);
  const framedFirstCloud = useRef(false);
  const [orbitTarget, setOrbitTarget] = useState<Vec3>([0, 0, 0]);
  const [surfaceRadius, setSurfaceRadius] = useState<number | null>(null);
  const trajectoryAvailable = Boolean(trajectory?.position_segments.length);
  useEffect(() => {
    if (clouds.length === 0) framedFirstCloud.current = false;
  }, [clouds.length]);
  useStopOrbitControlsInertia(
    orbitControlsRef,
    cameraMode === "orbit" && activeTool !== null,
  );

  useEffect(() => {
    if (cameraMode === "trajectory" && !trajectoryAvailable)
      setCameraMode("orbit");
  }, [cameraMode, setCameraMode, trajectoryAvailable]);

  useEffect(() => {
    renderingBackend.invalidate();
  }, [anchors, renderingBackend]);

  function handleSurfaceReady(cloudId: string, surface: SceneSurfaceReady) {
    setSurfaceRadius((radius) => Math.max(radius ?? 0, surface.bounds.radius));
    if (!framedFirstCloud.current) {
      framedFirstCloud.current = true;
      frameSurface(camera, surface.bounds, setOrbitTarget);
    }
    onSurfaceReady(cloudId);
  }

  function handleOrbitEnd() {
    const controls = orbitControlsRef.current;
    if (controls !== null) setOrbitTarget(controls.target.toArray() as Vec3);
  }
  const editorVisible = cameraMode === "orbit";
  // Equal projected depths share a z-index, so stable DOM order is the tie-breaker.
  const orderedAnchors = [...anchors].sort((left, right) =>
    left.id.localeCompare(right.id),
  );

  return (
    <SceneSurfaceProvider backend={renderingBackend}>
      {clouds.map((cloud) => (
        <ProjectCloudSurface
          cloud={cloud}
          key={cloud.id}
          onError={(error) => onSurfaceError(cloud.id, error)}
          onLoading={() => onSurfaceLoading(cloud.id)}
          onReady={(surface) => handleSurfaceReady(cloud.id, surface)}
          raycastable={cloud.visible && isGaussianSurfacePickActive(activeTool)}
          {...(editorVisible
            ? activeTool === "cloud"
              ? cloudPlacement.surfaceEventProps
              : placement.surfaceEventProps
            : {})}
        />
      ))}
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
      {editorVisible && pendingCloud && cloudPlacement.previewHit && (
        <CloudPlacementPreview
          asset={pendingCloud}
          hit={cloudPlacement.previewHit}
        />
      )}
      {editorVisible &&
        orderedAnchors.map((anchor) => {
          const markerAnchor =
            heightEditing.preview?.anchorId === anchor.id
              ? {
                  ...anchor,
                  lift: heightEditing.preview.lift,
                  lift_axis: "world_up" as const,
                }
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
          onOpenMenu={onOpenTrajectoryMenu}
          onSelect={onSelectTrajectory}
          selected={selected}
          trajectory={trajectory}
        />
      )}
      {editorVisible && trajectoryAvailable && trajectory && (
        <>
          <PlaybackCamera pathPosition={pathPosition} trajectory={trajectory} />
          {depthOfFieldSupported &&
            depthOfFieldFocus !== null &&
            surfaceRadius !== null && (
              <DepthOfFieldFocusHelper
                fallbackRayLength={surfaceRadius * 4}
                focus={depthOfFieldFocus}
                pathPosition={pathPosition}
                trajectory={trajectory}
              />
            )}
        </>
      )}
      {cameraMode === "orbit" ? (
        <OrbitControls
          enabled={activeTool === null}
          makeDefault
          maxDistance={Infinity}
          minDistance={0.001}
          onChange={() => {
            placement.handleControlsChange();
            cloudPlacement.handleControlsChange();
          }}
          onEnd={handleOrbitEnd}
          ref={orbitControlsRef}
          target={orbitTarget}
        />
      ) : trajectoryAvailable && trajectory ? (
        <>
          <TrajectoryCameraControl
            pathPosition={pathPosition}
            trajectory={trajectory}
          />
          {depthOfFieldEnabled && depthOfFieldKeyframe !== null && (
            <DepthOfField
              bokeh={depthOfFieldKeyframe.bokeh_scale}
              focalLength={Math.max(
                (surfaceRadius ?? 1) * depthOfFieldKeyframe.focus_range_scale,
                0.001,
              )}
              focus={depthOfFieldKeyframe.focus}
            />
          )}
        </>
      ) : null}
    </SceneSurfaceProvider>
  );
}
