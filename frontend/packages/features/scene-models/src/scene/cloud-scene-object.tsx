"use client";
import { useEffect, useEffectEvent, useMemo, useState } from "react";
import type { Matrix4 } from "three";
import { SceneObject as SceneObjectRoot } from "@camera-path/scene-runtime/interaction/scene-object";

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
  effectiveVisible: boolean;
  hoverable?: boolean;
}

export function CloudSceneObject({
  cloud,
  worldMatrix,
  effectiveVisible,
  hoverable = true,
  resourceKey,
  onReady,
  onLoading,
  onError,
  onProgress,
  ...props
}: CloudSceneObjectProps) {
  // Source and initial pose identities are consumed by the resource lease effect.
  const source = useMemo(
    () => ({
      kind: "url" as const,
      url: cloud.download_url,
      format: cloud.format,
    }),
    [cloud.download_url, cloud.format],
  );
  const initialWorldMatrix = useMemo(
    () => worldMatrix.toArray(),
    [worldMatrix],
  );
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
      <SceneObjectRoot
        sceneObjectID={cloud.id}
        hoverable={hoverable && effectiveVisible}
        matrix={worldMatrix}
        matrixAutoUpdate={false}
        visible={effectiveVisible}
      >
        {({ hovered }) => (
          <SceneSurface
            {...props}
            name={cloud.id}
            resourceKey={resourceKey}
            initialWorldMatrix={initialWorldMatrix}
            source={source}
            hovered={hovered}
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
      </SceneObjectRoot>
      {loading && effectiveVisible && (
        <CloudLoadingRing
          position={[
            worldMatrix.elements[12],
            worldMatrix.elements[13],
            worldMatrix.elements[14],
          ]}
          progress={load?.source === source ? load.progress : null}
        />
      )}
    </>
  );
}
