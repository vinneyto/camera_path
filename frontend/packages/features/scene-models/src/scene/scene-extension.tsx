"use client";
import type { ProjectCloud } from "@camera-path/contracts/api";
import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import {
  sceneModels,
  cameraMode,
  projectPermissions,
  editorTool,
} from "@camera-path/contracts/host-data";
import type { Vec3 } from "@camera-path/contracts/project";
import { useData, useDataQuery } from "@camera-path/extension-api";
import type { SceneSurfaceReady } from "@camera-path/scene-runtime/surface";
import { SurfaceTargetRing } from "@camera-path/scene-runtime/three/surface-target-ring";
import { useSceneServices } from "@camera-path/scene-runtime/viewport/scene-services-provider";
import { useViewportServices } from "@camera-path/scene-runtime/viewport/viewport-provider";
import { useSurfaceEvents } from "@camera-path/scene-runtime/viewport/use-surface-events";
import { useSceneEvent } from "@camera-path/scene-runtime/viewport/use-scene-event";
import { manifest } from "../manifest";
import { useProjectCloudActions } from "../api/use-project-cloud-actions";
import { resolveInitialSceneBounds } from "../lib/resolve-initial-scene-bounds";
import { useCloudPlacementInteraction } from "./use-cloud-placement-interaction";
import { useCloudPlacementRaycast } from "./use-cloud-placement-raycast";
import { SceneClouds } from "./scene-clouds";
const EMPTY: ProjectCloud[] = [];
export function SceneExtension() {
  const query = useDataQuery(manifest, sceneModels);
  const clouds = query.data?.data ?? EMPTY;
  const canEdit = useData(manifest, projectPermissions).canEdit;
  const mode = useData(manifest, cameraMode);
  const tool = useData(manifest, editorTool);
  const services = useSceneServices();
  const viewport = useViewportServices();
  const surfaceEvents = useSurfaceEvents();
  const action = useProjectCloudActions();
  const placement = useCloudPlacementInteraction({
    clouds,
    onPlace: async (assetId, position) => {
      if (action.isPending || !canEdit) return false;
      const result = await action.mutateAsync({
        type: "add",
        assetId,
        translation: position.map((v) => Number(v.toFixed(4))) as Vec3,
      });
      return result.status === 201;
    },
  });
  useCloudPlacementRaycast(
    canEdit && mode === "orbit" && tool.pendingCloud !== null,
    placement,
  );
  useSceneEvent("controlsChange", () => placement.handleControlsChange());
  const initial = useRef<readonly string[] | null>(null);
  const interrupted = useRef(false);
  const framed = useRef(false);
  const ready = useRef(new Map<string, SceneSurfaceReady["bounds"]>());
  const errors = useRef(new Set<string>());
  const errorMessages = useRef(new Map<string, string>());
  const [revision, setRevision] = useState(0);
  useSceneEvent("controlsStart", () => {
    interrupted.current = true;
  });
  const frameInitial = useEffectEvent(() => {
    if (
      !query.isSuccess ||
      mode !== "orbit" ||
      interrupted.current ||
      framed.current
    )
      return;
    initial.current ??= clouds.map((c) => c.id);
    if (!initial.current.length) return;
    const visible = clouds.filter((c) => c.visible);
    const current = new Set(visible.map((c) => c.id));
    const pending = new Map(
      visible.map((c) => [
        c.id,
        {
          center: c.translation,
          radius: 0.3,
          min: c.translation.map((v) => v - 0.3) as Vec3,
          max: c.translation.map((v) => v + 0.3) as Vec3,
        },
      ]),
    );
    const bounds = resolveInitialSceneBounds(
      initial.current,
      current,
      ready.current,
      errors.current,
      pending,
    );
    if (bounds) services.frame(bounds);
    if (
      initial.current.every(
        (id) =>
          !current.has(id) || ready.current.has(id) || errors.current.has(id),
      )
    )
      framed.current = true;
  });
  useLayoutEffect(
    () => frameInitial(),
    [clouds, mode, query.isSuccess, revision],
  );
  useEffect(() => {
    const ids = clouds.map((c) => c.id);
    for (const cloud of clouds) {
      if (ready.current.has(cloud.id)) continue;
      const error = errorMessages.current.get(cloud.id);
      viewport.setMessage(`scene-models.${cloud.id}`, {
        text: `${cloud.name}: ${error ?? "Loading…"}`,
        error: !!error,
      });
    }
    return () => {
      for (const id of ids) viewport.setMessage(`scene-models.${id}`, null);
    };
  }, [clouds, viewport]);
  const report = services.reportBounds;
  useEffect(() => {
    const resources = ready.current;
    for (const [id, bounds] of resources) report(id, bounds);
    return () => {
      for (const id of resources.keys()) report(id, null);
    };
  }, [report]);
  useEffect(() => {
    const current = new Set(clouds.map((c) => c.id));
    for (const id of ready.current.keys())
      if (!current.has(id)) {
        ready.current.delete(id);
        report(id, null);
      }
  }, [clouds, report]);
  const error = action.error ?? query.error;
  useEffect(() => {
    viewport.setMessage(
      "scene-models.error",
      error ? { text: error.message, error: true } : null,
    );
    return () => viewport.setMessage("scene-models.error", null);
  }, [viewport, error]);
  return (
    <>
      <SceneClouds
        clouds={clouds}
        preview={canEdit && mode === "orbit" ? placement.preview : null}
        placed={placement.placed}
        resourceKeyForCloud={placement.resourceKeyForCloud}
        interactive={
          mode === "orbit" &&
          (tool.activeTool === "anchor" || tool.activeTool === "cloud")
        }
        surfaceEvents={
          canEdit && mode === "orbit" && tool.activeTool !== "cloud"
            ? surfaceEvents
            : {}
        }
        onReady={(id, surface) => {
          placement.finishPlacement(id);
          ready.current.set(id, surface.bounds);
          errors.current.delete(id);
          errorMessages.current.delete(id);
          report(id, surface.bounds);
          viewport.setMessage(`scene-models.${id}`, null);
          setRevision((n) => n + 1);
        }}
        onLoading={(id) => {
          ready.current.delete(id);
          errors.current.delete(id);
          errorMessages.current.delete(id);
          report(id, null);
          const cloud = clouds.find((c) => c.id === id);
          viewport.setMessage(`scene-models.${id}`, {
            text: `${cloud?.name ?? id}: Loading…`,
          });
        }}
        onError={(id, error) => {
          ready.current.delete(id);
          errors.current.add(id);
          errorMessages.current.set(id, error.message);
          report(id, null);
          viewport.setMessage(`scene-models.${id}`, {
            text: `${clouds.find((c) => c.id === id)?.name ?? id}: ${error.message}`,
            error: true,
          });
          setRevision((n) => n + 1);
        }}
      />
      {((canEdit && mode === "orbit" && placement.preview) ||
        placement.placed) && (
        <Suspense fallback={null}>
          <SurfaceTargetRing
            position={(placement.placed ?? placement.preview)!.hit.position}
          />
        </Suspense>
      )}
    </>
  );
}
