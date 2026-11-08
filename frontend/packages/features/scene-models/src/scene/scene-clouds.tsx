"use client";
import { useMemo } from "react";
import { Matrix4, Quaternion } from "three";
import type { SceneObjectTransformInteraction } from "@camera-path/types/scene-object-transform";
import { resolveSceneObjectTransforms } from "./resolve-scene-object-transforms";
import { createPlacementPreviewCloud } from "@camera-path/feature-scene-models/scene/create-placement-preview-cloud";
import { CloudSceneObject } from "@camera-path/feature-scene-models/scene/cloud-scene-object";
import type { PlacementPreview } from "@camera-path/feature-scene-models/scene/use-cloud-placement-interaction";
import type { SceneSurfaceProps } from "@camera-path/scene-runtime/surface/model/scene-surface-types";
import type { SceneObject } from "@camera-path/types/api";

interface SceneCloudsProps {
  transformInteraction?: SceneObjectTransformInteraction;
  transformEditable?: boolean;
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
const ROOT_MATRIX = new Matrix4();
const ROOT_ROTATION = new Quaternion();

export function SceneClouds({
  clouds,
  transformInteraction,
  transformEditable = false,
  preview,
  placed,
  resourceKeyForCloud,
  interactive,
  surfaceEvents,
  onReady,
  onError,
  onLoading,
}: SceneCloudsProps) {
  const draft = transformInteraction?.preview;
  const displayClouds = useMemo(
    () =>
      draft
        ? clouds.map((cloud) =>
            cloud.id === draft.id ? { ...cloud, ...draft.transform } : cloud,
          )
        : clouds,
    [clouds, draft],
  );
  // Stable world matrices prevent repeated bounds notifications.
  const transforms = useMemo(
    () =>
      resolveSceneObjectTransforms([
        ...displayClouds,
        ...[preview, placed]
          .filter(
            (candidate): candidate is PlacementPreview => candidate !== null,
          )
          .map(createPlacementPreviewCloud),
      ]),
    [displayClouds, preview, placed],
  );
  const entries = displayClouds.map((cloud) => ({
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
    <CloudSceneObject
      key={resourceKey ?? cloud.id}
      cloud={cloud}
      worldMatrix={transforms.get(cloud.id)!.matrix}
      parentMatrix={
        cloud.parent_id ? transforms.get(cloud.parent_id)!.matrix : ROOT_MATRIX
      }
      parentRotation={
        cloud.parent_id
          ? transforms.get(cloud.parent_id)!.rotation
          : ROOT_ROTATION
      }
      transformInteraction={transformInteraction}
      transformEditable={!preview && transformEditable}
      effectiveVisible={transforms.get(cloud.id)!.visible}
      hoverable={!preview}
      selectable={!preview}
      resourceKey={resourceKey}
      raycastable={!preview && transforms.get(cloud.id)!.visible && interactive}
      onReady={preview ? undefined : (surface) => onReady(cloud.id, surface)}
      onLoading={preview ? undefined : () => onLoading(cloud.id)}
      onError={preview ? undefined : (error) => onError(cloud.id, error)}
      {...(preview ? {} : surfaceEvents)}
    />
  ));
}
