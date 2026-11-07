"use client";
import { useDeleteAnchorMutation } from "@camera-path/actions";
import { useAuth } from "@camera-path/api/identity/auth-provider";
import { useAnchors } from "@camera-path/api/resources";
import { useCameraState } from "@camera-path/store";
import { SceneObject } from "@camera-path/scene-runtime/interaction/scene-object";
import { anchorObjectId } from "@camera-path/types/anchor-object-id";

import {
  useAddAnchorMutation,
  useUpdateAnchorMutation,
} from "@camera-path/actions";
import { useSceneServices } from "@camera-path/scene-runtime/viewport/scene-services-provider";
import { useSceneEvent } from "@camera-path/scene-runtime/viewport/use-scene-event";
import { useViewportServices } from "@camera-path/scene-runtime/viewport/viewport-provider";
import type { Anchor, Vec3 } from "@camera-path/types/project";
import { useEffect } from "react";
import { getAnchorLabel } from "../lib/get-anchor-label";
import { useActiveEditorTool } from "../ports/use-active-editor-tool";
import { AnchorToolShortcut } from "../ui/anchor-tool-shortcut";
import { AnchorHeightEditingOverlay } from "./anchor-height-editing-overlay";
import { AnchorMarker } from "./anchor-marker";
import { AnchorPlacementPreview } from "./anchor-placement-preview";
import { useAnchorHeightEditing } from "./use-anchor-height-editing";
import { useAnchorPlacement } from "./use-anchor-placement";
import { ANCHOR_TRANSFORM_PRECISION } from "../constants";
import { ANCHOR_PLACEMENT_HEIGHT } from "./anchor-placement-constants";
const EMPTY: Anchor[] = [];
export function AnchorsScene() {
  const query = useAnchors();
  const items = query.data?.data ?? EMPTY;
  const mode = useCameraState().cameraMode;
  const canEdit = useAuth().canEdit;
  const activeTool = useActiveEditorTool();
  const services = useSceneServices();
  const viewport = useViewportServices();
  const add = useAddAnchorMutation();
  const update = useUpdateAnchorMutation();
  const deletion = useDeleteAnchorMutation();
  const busy = add.isPending || update.isPending || deletion.isPending;
  const placement = useAnchorPlacement({
    onPlace: (position, normal) => {
      if (!busy && canEdit)
        add.mutate({
          label: getAnchorLabel(items),
          surface_position: position.map((v) =>
            Number(v.toFixed(ANCHOR_TRANSFORM_PRECISION)),
          ) as Vec3,
          surface_normal: normal.map((v) =>
            Number(v.toFixed(ANCHOR_TRANSFORM_PRECISION)),
          ) as Vec3,
          lift: ANCHOR_PLACEMENT_HEIGHT,
          lift_axis: "world_up",
        });
    },
  });
  const height = useAnchorHeightEditing({
    anchors: items,
    onCommit: async (anchorId, lift) => {
      await update.mutateAsync({ anchorId, lift }).catch(() => undefined);
    },
  });
  const enabled = canEdit && mode === "orbit" && activeTool !== "cloud";
  useSceneEvent("surfacePointerDown", ({ hit, event }) => {
    if (enabled) placement.surfaceEventProps.onSurfacePointerDown(hit, event);
  });
  useSceneEvent("surfacePointerMove", ({ hit, event }) => {
    if (enabled) placement.surfaceEventProps.onSurfacePointerMove(hit, event);
  });
  useSceneEvent("surfacePointerUp", ({ hit, event }) => {
    if (enabled) placement.surfaceEventProps.onSurfacePointerUp(hit, event);
  });
  useSceneEvent("surfacePointerOut", () =>
    placement.surfaceEventProps.onPointerOut(),
  );
  useSceneEvent("surfacePointerCancel", (event) =>
    placement.surfaceEventProps.onPointerCancel(event),
  );
  useSceneEvent("controlsChange", () => placement.handleControlsChange());
  useEffect(() => {
    services.backend.invalidate();
  }, [items, services.backend]);
  const error = add.error ?? update.error ?? deletion.error ?? query.error;
  useEffect(() => {
    viewport.setMessage(
      "anchors.error",
      error ? { text: error.message, error: true } : null,
    );
    return () => viewport.setMessage("anchors.error", null);
  }, [viewport, error]);
  const cursor =
    mode === "orbit" &&
    (height.hoveredAnchorId || activeTool === "anchor-height")
      ? "default"
      : null;
  useEffect(() => {
    viewport.setCursor("anchors.scene", cursor);
    return () => viewport.setCursor("anchors.scene", null);
  }, [viewport, cursor]);
  return (
    <>
      {canEdit && <AnchorToolShortcut />}
      {mode === "orbit" && (
        <>
          {canEdit && placement.previewHit && (
            <AnchorPlacementPreview
              backend={services.backend}
              hit={placement.previewHit}
              label={getAnchorLabel(items)}
            />
          )}
          {[...items]
            .sort((a, b) => a.id.localeCompare(b.id))
            .map((anchor) => (
              <SceneObject
                key={anchor.id}
                sceneObjectID={anchorObjectId(anchor.id)}
                hoverable={canEdit && activeTool === null}
              >
                {({ hovered }) => (
                  <AnchorMarker
                    anchor={
                      height.preview?.anchorId === anchor.id
                        ? {
                            ...anchor,
                            lift: height.preview.lift,
                            lift_axis: "world_up",
                          }
                        : anchor
                    }
                    hovered={hovered}
                    dragging={
                      height.preview?.anchorId === anchor.id &&
                      height.preview.dragging
                    }
                    selected={height.selectedAnchorId === anchor.id}
                    {...(canEdit
                      ? height.getAnchorInteractionProps(anchor)
                      : {})}
                    onContextMenu={
                      canEdit
                        ? (event) => {
                            event.stopPropagation();
                            event.nativeEvent.preventDefault();
                            viewport.openMenu(
                              [
                                {
                                  destructive: true,
                                  disabled: deletion.isPending,
                                  label: `Delete anchor ${anchor.label}`,
                                  onSelect: () => deletion.mutate(anchor.id),
                                },
                              ],
                              {
                                x: event.nativeEvent.clientX,
                                y: event.nativeEvent.clientY,
                              },
                            );
                          }
                        : undefined
                    }
                  />
                )}
              </SceneObject>
            ))}
          {canEdit && height.activeAnchor && (
            <AnchorHeightEditingOverlay
              anchor={height.activeAnchor}
              backend={services.backend}
              dragging={height.preview?.dragging ?? false}
              lift={height.preview?.lift ?? height.activeAnchor.lift}
            />
          )}
        </>
      )}
    </>
  );
}
