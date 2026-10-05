import type { ProjectCloud } from "@/shared/api/generated/model";
import type { SceneSurfaceProps } from "@/shared/scene-surface/model/scene-surface-types";
import { createPlacementPreviewCloud } from "./create-placement-preview-cloud";
import { ProjectCloudSurface } from "./project-cloud-surface";
import type { PlacementPreview } from "./use-cloud-placement-interaction";

interface SceneCloudsProps {
  clouds: ProjectCloud[];
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
    <ProjectCloudSurface
      key={resourceKey ?? cloud.id}
      cloud={cloud}
      resourceKey={resourceKey}
      raycastable={!preview && cloud.visible && interactive}
      onReady={preview ? undefined : (surface) => onReady(cloud.id, surface)}
      onLoading={preview ? undefined : () => onLoading(cloud.id)}
      onError={preview ? undefined : (error) => onError(cloud.id, error)}
      {...(preview ? {} : surfaceEvents)}
    />
  ));
}
