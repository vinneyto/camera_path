"use client";
import type { Anchor } from "@camera-path/contracts/project";
import { useEffect } from "react";
import {
  anchors,
  cameraMode,
  projectPermissions,
} from "@camera-path/contracts/host-data";
import { deleteAnchor } from "@camera-path/contracts/host-requests";
import type { Vec3 } from "@camera-path/contracts/project";
import {
  useData,
  useDataQuery,
  useRequestMutation,
} from "@camera-path/extension-api";
import { useSceneServices } from "@camera-path/scene-runtime/viewport/scene-services-provider";
import { useViewportServices } from "@camera-path/scene-runtime/viewport/viewport-provider";
import { useSceneEvent } from "@camera-path/scene-runtime/viewport/use-scene-event";
import { useAddAnchor } from "../api/use-add-anchor";
import { useUpdateAnchor } from "../api/use-update-anchor";
import { useActiveEditorTool } from "../ports";
import { manifest } from "../manifest";
import { getAnchorLabel } from "../lib/get-anchor-label";
import { AnchorToolShortcut } from "../ui/anchor-tool-shortcut";
import { AnchorMarker } from "./anchor-marker";
import { AnchorPlacementPreview } from "./anchor-placement-preview";
import { AnchorHeightEditingOverlay } from "./anchor-height-editing-overlay";
import { useAnchorPlacement } from "./use-anchor-placement";
import { useAnchorHeightEditing } from "./use-anchor-height-editing";
const EMPTY: Anchor[] = [];
export function SceneExtension() {
  const query = useDataQuery(manifest, anchors);
  const items = query.data?.data ?? EMPTY;
  const mode = useData(manifest, cameraMode);
  const canEdit = useData(manifest, projectPermissions).canEdit;
  const activeTool = useActiveEditorTool();
  const services = useSceneServices();
  const viewport = useViewportServices();
  const add = useAddAnchor();
  const update = useUpdateAnchor();
  const deletion = useRequestMutation(manifest, deleteAnchor);
  const busy = add.isPending || update.isPending || deletion.isPending;
  const placement = useAnchorPlacement({
    onPlace: (position, normal) => {
      if (!busy && canEdit)
        add.mutate({
          label: getAnchorLabel(items),
          surface_position: position.map((v) => Number(v.toFixed(4))) as Vec3,
          surface_normal: normal.map((v) => Number(v.toFixed(4))) as Vec3,
          lift: 0.5,
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
  if (mode !== "orbit") return null;
  return (
    <>
      {canEdit && <AnchorToolShortcut />}
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
          <AnchorMarker
            key={anchor.id}
            anchor={
              height.preview?.anchorId === anchor.id
                ? {
                    ...anchor,
                    lift: height.preview.lift,
                    lift_axis: "world_up",
                  }
                : anchor
            }
            hovered={height.hoveredAnchorId === anchor.id}
            selected={height.selectedAnchorId === anchor.id}
            {...(canEdit ? height.getAnchorInteractionProps(anchor) : {})}
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
  );
}
