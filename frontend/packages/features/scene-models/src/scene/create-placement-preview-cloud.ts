import type { PlacementPreview } from "@camera-path/feature-scene-models/scene/use-cloud-placement-interaction";
import type { SceneObject } from "@camera-path/types/api";
import { createLibraryObjectTransform } from "./create-library-object-transform";

export function createPlacementPreviewCloud({
  asset,
  hit,
  resourceKey,
}: PlacementPreview): SceneObject {
  return {
    id: `cloud-placement-${resourceKey}`,
    project_id: "",
    parent_id: null,
    library_asset_id: asset.id,
    library_asset_file_id: asset.primary_file_id,
    name: asset.name,
    format: asset.format,
    sort_order: 0,
    visible: true,
    download_url: asset.download_url!,
    ...createLibraryObjectTransform(asset, hit.position),
  };
}
