"use client";
import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { Vector3, type Matrix4, type Quaternion } from "three";
import { SceneObjectInteractor } from "@camera-path/scene-runtime/interaction/scene-object-interactor";
import type { SceneObjectTransformInteraction } from "@camera-path/types/scene-object-transform";

import {
  SceneSurface,
  type GaussianCloudLoadProgress,
  type SceneSurfaceBounds,
} from "@camera-path/scene-runtime/surface";
import type { SceneSurfaceProps } from "@camera-path/scene-runtime/surface/model/scene-surface-types";
import type { SceneObject } from "@camera-path/types/api";
import { CloudLoadingRing } from "./cloud-loading-ring";
import { transformSceneObjectBounds } from "./transform-scene-object-bounds";

interface CloudSceneObjectProps extends Omit<SceneSurfaceProps, "source"> {
  cloud: SceneObject;
  worldMatrix: Matrix4;
  parentMatrix: Matrix4;
  parentRotation: Quaternion;
  transformInteraction?: SceneObjectTransformInteraction;
  transformEditable?: boolean;
  effectiveVisible: boolean;
  hoverable?: boolean;
  selectable?: boolean;
}

export function CloudSceneObject({
  cloud,
  worldMatrix,
  parentMatrix,
  parentRotation,
  transformInteraction,
  transformEditable = false,
  effectiveVisible,
  hoverable = true,
  selectable = true,
  resourceKey,
  onReady,
  onLoading,
  onError,
  onProgress,
  ...props
}: CloudSceneObjectProps) {
  // Source identity is consumed by the resource lease effect.
  const source = useMemo(
    () => ({
      kind: "url" as const,
      url: cloud.download_url,
      format: cloud.format,
    }),
    [cloud.download_url, cloud.format],
  );
  const initialWorldMatrix = worldMatrix.toArray();
  const [bounds, setBounds] = useState<SceneSurfaceBounds | null>(null);
  const [load, setLoad] = useState<{
    source: typeof source;
    status: "loading" | "ready" | "error";
    progress: GaussianCloudLoadProgress | null;
  } | null>(null);
  const loading = load?.source !== source || load.status === "loading";
  const notifyBounds = useEffectEvent(() => {
    if (bounds)
      onReady?.({ bounds: transformSceneObjectBounds(bounds, worldMatrix) });
  });
  useEffect(() => {
    notifyBounds();
  }, [bounds, worldMatrix, effectiveVisible]);
  return (
    <>
      <SceneObjectInteractor
        model={cloud}
        worldMatrix={worldMatrix}
        parentMatrix={parentMatrix}
        parentRotation={parentRotation}
        interaction={transformInteraction}
        editable={transformEditable && effectiveVisible && !loading}
        hoverable={hoverable && effectiveVisible}
        selectable={selectable && effectiveVisible}
        visible={effectiveVisible}
      >
        {({ hovered, selected }) => (
          <SceneSurface
            {...props}
            name={cloud.id}
            resourceKey={resourceKey}
            initialWorldMatrix={initialWorldMatrix}
            source={source}
            hovered={hovered}
            selected={selected}
            onReady={(surface) => {
              setBounds(surface.bounds);
              setLoad({ source, status: "ready", progress: null });
            }}
            onLoading={() => {
              setBounds(null);
              setLoad({ source, status: "loading", progress: null });
              onLoading?.();
            }}
            onProgress={(progress) => {
              setLoad((current) => ({
                source,
                status:
                  current?.source === source && current.status === "ready"
                    ? "ready"
                    : "loading",
                progress,
              }));
              onProgress?.(progress);
            }}
            onError={(error) => {
              setBounds(null);
              setLoad({ source, status: "error", progress: null });
              onError?.(error);
            }}
          />
        )}
      </SceneObjectInteractor>
      {loading && effectiveVisible && (
        <CloudLoadingRing
          position={new Vector3().setFromMatrixPosition(worldMatrix).toArray()}
          progress={load?.source === source ? load.progress : null}
        />
      )}
    </>
  );
}
