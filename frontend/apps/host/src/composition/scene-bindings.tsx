import { ContributionRegistry } from "@camera-path/extension-api/contribution-registry";
import * as f3 from "@camera-path/feature-anchors";
import {
  AnchorHeightEditingOverlay,
  AnchorMarker,
  AnchorPlacementPreview,
  getAnchorLabel,
} from "@camera-path/feature-anchors";
import * as f0 from "@camera-path/feature-lidar";
import { LidarCloud } from "@camera-path/feature-lidar";
import * as f2 from "@camera-path/feature-scene-grid";
import { SceneGrid } from "@camera-path/feature-scene-grid";
import * as f1 from "@camera-path/feature-scene-models";
import { SceneClouds } from "@camera-path/feature-scene-models";
import * as f4 from "@camera-path/feature-trajectory";
import { TrajectoryLine } from "@camera-path/feature-trajectory";
import { SurfaceTargetRing } from "@camera-path/scene-runtime/three/surface-target-ring";
import { EditorOnly } from "@host/ui/header";
import { isGaussianSurfacePickActive } from "@host/ui/scene-editor/lib/is-gaussian-surface-pick-active";
import type { ReactNode } from "react";
import { Fragment, Suspense } from "react";
import type { SceneCompositionInputs } from "./scene-inputs";
export function SceneRootContributions({
  lidar,
  trajectoryAvailable,
  trajectory,
  clouds,
  cloudPlacement,
  editorVisible,
  activeTool,
  canEdit,
  placement,
  handleSurfaceReady,
  handleSurfaceError,
  handleSurfaceLoading,
  showGrid,
  dark,
  cameraMode,
  renderingBackend,
  anchors,
  orderedAnchors,
  heightEditing,
  onOpenAnchorMenu,
  onOpenTrajectoryMenu,
  onSelectTrajectory,
  selected,
}: SceneCompositionInputs): ReactNode {
  const registry = new ContributionRegistry<ReactNode>();
  registry.register(
    f0.manifest,
    "lidar.scene",
    <>
      {lidar && trajectoryAvailable && trajectory && (
        <LidarCloud settings={lidar} />
      )}
    </>,
  );
  registry.register(
    f1.manifest,
    "scene-models.scene",
    <>
      <SceneClouds
        clouds={clouds}
        preview={editorVisible ? cloudPlacement.preview : null}
        placed={cloudPlacement.placed}
        resourceKeyForCloud={cloudPlacement.resourceKeyForCloud}
        interactive={isGaussianSurfacePickActive(activeTool)}
        surfaceEvents={
          canEdit && editorVisible && activeTool !== "cloud"
            ? placement.surfaceEventProps
            : {}
        }
        onReady={handleSurfaceReady}
        onError={handleSurfaceError}
        onLoading={handleSurfaceLoading}
      />
      {((editorVisible && cloudPlacement.preview) || cloudPlacement.placed) && (
        <Suspense fallback={null}>
          <SurfaceTargetRing
            position={
              (cloudPlacement.placed ?? cloudPlacement.preview)!.hit.position
            }
          />
        </Suspense>
      )}
    </>,
  );
  registry.register(
    f2.manifest,
    "scene-grid.scene",
    <>
      {showGrid && (
        <SceneGrid
          dark={dark}
          interactive={cameraMode === "orbit"}
          placementEvents={
            canEdit && activeTool !== "cloud" ? placement.surfaceEventProps : {}
          }
        />
      )}
    </>,
  );
  registry.register(
    f3.manifest,
    "anchors.scene",
    <>
      {editorVisible && placement.previewHit !== null && (
        <AnchorPlacementPreview
          backend={renderingBackend}
          hit={placement.previewHit}
          label={getAnchorLabel(anchors)}
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
            <EditorOnly
              key={anchor.id}
              fallback={<AnchorMarker anchor={anchor} />}
            >
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
            </EditorOnly>
          );
        })}
      <EditorOnly>
        {editorVisible && heightEditing.activeAnchor !== null && (
          <AnchorHeightEditingOverlay
            anchor={heightEditing.activeAnchor}
            backend={renderingBackend}
            dragging={heightEditing.preview?.dragging ?? false}
            lift={
              heightEditing.preview?.lift ?? heightEditing.activeAnchor.lift
            }
          />
        )}
      </EditorOnly>
    </>,
  );
  registry.register(
    f4.manifest,
    "trajectory.scene",
    <>
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
    </>,
  );
  return registry
    .list("scene.root")
    .map((node, index) => <Fragment key={index}>{node}</Fragment>);
}
