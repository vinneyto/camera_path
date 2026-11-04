"use client";
import { useMemo } from "react";
import { resolveSceneObjectTransforms } from "./resolve-scene-object-transforms";
import { createPlacementPreviewCloud } from "@camera-path/feature-scene-models/scene/create-placement-preview-cloud";
import { SceneObjectSurface } from "@camera-path/feature-scene-models/scene/scene-object-surface";
import type { PlacementPreview } from "@camera-path/feature-scene-models/scene/use-cloud-placement-interaction";
import type { SceneSurfaceProps } from "@camera-path/scene-runtime/surface/model/scene-surface-types";
import type { SceneObject } from "@camera-path/types/api";

interface SceneCloudsProps {
  clouds: SceneObject[];
  preview: PlacementPreview | null;
  placed: PlacementPreview | null;
  resourceKeyForCloud: (id: string) => string | undefined;
  interactive: boolean;
  surfaceEvents: Pick<
    SceneSurfaceProps,
    | "onSurfacePointerDown"
    | "onSurfacePointerMove"
    | "onSurfacePointerUp"
    | "onPointerOut"
    | "onPointerCancel"
  >;
  onReady: (
    id: string,
    surface: Parameters<NonNullable<SceneSurfaceProps["onReady"]>>[0],
  ) => void;
  onError: (id: string, error: Error) => void;
  onLoading: (id: string) => void;
}

export function SceneClouds({
  clouds,
  preview,
  placed,
  resourceKeyForCloud,
  interactive,
  surfaceEvents,
  onReady,
  onError,
  onLoading,
}: SceneCloudsProps) {
  // Stable world matrices keep loading leases and bounds notifications stable.
  const transforms = useMemo(
    () =>
      resolveSceneObjectTransforms([
        ...clouds,
        ...[preview, placed]
          .filter(
            (candidate): candidate is PlacementPreview => candidate !== null,
          )
          .map(createPlacementPreviewCloud),
      ]),
    [clouds, preview, placed],
  );
  const entries = clouds.map((cloud) => ({
    cloud,
    resourceKey: resourceKeyForCloud(cloud.id),
    preview: false,
  }));
  for (const candidate of [preview, placed]) {
    if (
      candidate?.asset.download_url &&
      !entries.some((entry) => entry.resourceKey === candidate.resourceKey)
    )
      entries.push({
        cloud: createPlacementPreviewCloud(candidate),
        resourceKey: candidate.resourceKey,
        preview: true,
      });
  }
  // A resource keeps one React/R3F owner throughout preview -> saved cloud.
  // Mounting a second primitive for the same object loses R3F pointer registration.
  return entries.map(({ cloud, resourceKey, preview }) => (
    <SceneObjectSurface
      key={resourceKey ?? cloud.id}
      cloud={cloud}
      worldMatrix={transforms.get(cloud.id)!.matrix}
      effectiveVisible={transforms.get(cloud.id)!.visible}
      resourceKey={resourceKey}
      raycastable={!preview && transforms.get(cloud.id)!.visible && interactive}
      onReady={preview ? undefined : (surface) => onReady(cloud.id, surface)}
      onLoading={preview ? undefined : () => onLoading(cloud.id)}
      onError={preview ? undefined : (error) => onError(cloud.id, error)}
      {...(preview ? {} : surfaceEvents)}
    />
  ));
}
