import { DepthOfField } from "@camera-path/feature-depth-of-field";
import { SceneRootContributions } from "@host/composition/scene-bindings";
import { SceneFrameProvider } from "@host/runtime/scene-frame-provider";
import { useAuth } from "@host/ui/header";
import { OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import type { ProjectCloud } from "@camera-path/contracts/api";
import {
  SceneSurfaceProvider,
  useGaussianRenderingBackend,
  type SceneSurfaceBackground,
  type SceneSurfaceReady,
} from "@camera-path/scene-runtime/surface";
import { DEPTH_OF_FIELD_AUTOFOCUS_LAYER } from "@camera-path/scene-runtime/three";
import {
  evaluateDepthOfFieldKeyframe,
  type CompiledTrajectory,
} from "@camera-path/trajectory-math";
import type { ContextMenuPosition } from "@camera-path/ui-kit";
import type { Anchor, Vec3 } from "@host/adapters/project";
import { useUserSettings } from "@host/adapters/settings";
import {
  useActiveEditorTool,
  useCameraMode,
  useCloudPlacement,
  useEditorHoverCursor,
  useSceneGrid,
} from "@host/editor";

import {
  useAnchorHeightEditing,
  useAnchorPlacement,
} from "@camera-path/feature-anchors";
import {
  PlaybackCamera,
  TrajectoryCameraControl,
  useStopOrbitControlsInertia,
} from "@camera-path/feature-camera-view";
import { DepthOfFieldFocusHelper } from "@camera-path/feature-depth-of-field";
import {
  useCloudPlacementInteraction,
  useCloudPlacementRaycast,
} from "@camera-path/feature-scene-models";
import { frameSurface } from "@host/ui/scene-editor/ui/frame-surface";
import { resolveInitialSceneBounds } from "@host/ui/scene-editor/ui/resolve-initial-scene-bounds";

const GAUSSIAN_CLOUD_LAYERS = [DEPTH_OF_FIELD_AUTOFOCUS_LAYER] as const;

export interface SceneContentsProps {
  lidar?: import("@camera-path/contracts/api").LidarKeyframe | null;
  anchors: Anchor[];
  clouds: ProjectCloud[];
  initialCloudIds: string[] | null;
  background: SceneSurfaceBackground;
  dark: boolean;
  depthOfFieldSupported?: boolean;
  onAddAnchor: (position: Vec3, normal: Vec3) => void;
  onAddCloud: (assetId: string, position: Vec3) => Promise<boolean>;
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
  lidar,
  anchors,
  clouds,
  initialCloudIds,
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
  const { canEdit } = useAuth();
  const camera = useThree((state) => state.camera);
  const activeTool = useActiveEditorTool();
  const { showGrid } = useSceneGrid();
  const { cameraMode, setCameraMode } = useCameraMode();
  useEditorHoverCursor();
  const { gaussianDpr: gaussianDprMode } = useUserSettings();
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
  const placement = useAnchorPlacement({
    onPlace: onAddAnchor,
  });
  const cloudPlacement = useCloudPlacementInteraction({
    onPlace: onAddCloud,
    clouds,
  });
  const { pendingCloud } = useCloudPlacement();
  useCloudPlacementRaycast(
    cameraMode === "orbit" && pendingCloud !== null,
    cloudPlacement,
  );
  const heightEditing = useAnchorHeightEditing({
    anchors,
    onCommit: onUpdateAnchorLift,
  });
  const orbitControlsRef = useRef<OrbitControlsImpl>(null);
  const framedInitialScene = useRef(false);
  const initialFrameInterrupted = useRef(false);
  const cloudBounds = useRef(new Map<string, SceneSurfaceReady["bounds"]>());
  const cloudErrors = useRef(new Set<string>());
  const [orbitTarget, setOrbitTarget] = useState<Vec3>([0, 0, 0]);
  const [surfaceRadius, setSurfaceRadius] = useState<number | null>(null);
  const trajectoryAvailable = Boolean(trajectory?.position_segments.length);
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

  function fitClouds(cloudIds: readonly string[]): boolean {
    const visibleClouds = clouds.filter((cloud) => cloud.visible);
    const currentIds = new Set(visibleClouds.map((cloud) => cloud.id));
    const pendingBounds = new Map(
      visibleClouds.map((cloud) => [
        cloud.id,
        {
          center: cloud.translation,
          radius: 0.3,
          min: cloud.translation.map((value) => value - 0.3) as Vec3,
          max: cloud.translation.map((value) => value + 0.3) as Vec3,
        },
      ]),
    );
    const bounds = resolveInitialSceneBounds(
      cloudIds,
      currentIds,
      cloudBounds.current,
      cloudErrors.current,
      pendingBounds,
    );
    if (bounds === null) return false;
    frameSurface(camera, bounds, setOrbitTarget);
    return true;
  }

  function tryFrameInitialScene() {
    if (
      framedInitialScene.current ||
      initialFrameInterrupted.current ||
      cameraMode !== "orbit" ||
      !initialCloudIds?.length
    )
      return;
    fitClouds(initialCloudIds);
    const visibleIds = new Set(
      clouds.filter((cloud) => cloud.visible).map((cloud) => cloud.id),
    );
    if (
      initialCloudIds.every(
        (id) =>
          !visibleIds.has(id) ||
          cloudBounds.current.has(id) ||
          cloudErrors.current.has(id),
      )
    )
      framedInitialScene.current = true;
  }

  const frameKnownPositions = useEffectEvent(() => tryFrameInitialScene());
  useLayoutEffect(() => {
    frameKnownPositions();
  }, [clouds, initialCloudIds, cameraMode]);

  function handleSurfaceReady(cloudId: string, surface: SceneSurfaceReady) {
    cloudPlacement.finishPlacement(cloudId);
    setSurfaceRadius((radius) => Math.max(radius ?? 0, surface.bounds.radius));
    cloudBounds.current.set(cloudId, surface.bounds);
    cloudErrors.current.delete(cloudId);
    tryFrameInitialScene();
    onSurfaceReady(cloudId);
  }

  function handleSurfaceError(cloudId: string, error: Error) {
    cloudBounds.current.delete(cloudId);
    cloudErrors.current.add(cloudId);
    tryFrameInitialScene();
    onSurfaceError(cloudId, error);
  }

  function handleSurfaceLoading(cloudId: string) {
    cloudBounds.current.delete(cloudId);
    cloudErrors.current.delete(cloudId);
    onSurfaceLoading(cloudId);
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
      <SceneFrameProvider
        backend={renderingBackend}
        trajectory={trajectory}
        pathPosition={pathPosition}
      >
        <SceneRootContributions
          lidar={lidar}
          trajectoryAvailable={trajectoryAvailable}
          trajectory={trajectory}
          clouds={clouds}
          cloudPlacement={cloudPlacement}
          editorVisible={editorVisible}
          activeTool={activeTool}
          canEdit={canEdit}
          placement={placement}
          handleSurfaceReady={handleSurfaceReady}
          handleSurfaceError={handleSurfaceError}
          handleSurfaceLoading={handleSurfaceLoading}
          showGrid={showGrid}
          dark={dark}
          cameraMode={cameraMode}
          renderingBackend={renderingBackend}
          anchors={anchors}
          orderedAnchors={orderedAnchors}
          heightEditing={heightEditing}
          onOpenAnchorMenu={onOpenAnchorMenu}
          onOpenTrajectoryMenu={onOpenTrajectoryMenu}
          onSelectTrajectory={onSelectTrajectory}
          selected={selected}
        />

        <ambientLight intensity={dark ? 0.8 : 1.25} />
        <directionalLight
          castShadow
          intensity={dark ? 1.7 : 2.1}
          position={[5, 8, 4]}
          shadow-mapSize={[1024, 1024]}
        />

        {editorVisible && trajectoryAvailable && trajectory && (
          <>
            <PlaybackCamera
              pathPosition={pathPosition}
              trajectory={trajectory}
            />
            {depthOfFieldSupported &&
              depthOfFieldFocus !== null &&
              surfaceRadius !== null && (
                <DepthOfFieldFocusHelper
                  fallbackRayLength={surfaceRadius * 4}
                  focus={depthOfFieldFocus}
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
            onStart={() => {
              initialFrameInterrupted.current = true;
            }}
            onEnd={handleOrbitEnd}
            ref={orbitControlsRef}
            target={orbitTarget}
          />
        ) : trajectoryAvailable && trajectory ? (
          <>
            <TrajectoryCameraControl />
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
      </SceneFrameProvider>
    </SceneSurfaceProvider>
  );
}
