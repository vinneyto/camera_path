import type { PlacementPreview } from "@camera-path/feature-scene-models/scene/use-cloud-placement-interaction";
import type { ProjectCloud } from "@camera-path/types/api";

export function createPlacementPreviewCloud({
  asset,
  hit,
}: PlacementPreview): ProjectCloud {
  return {
    id: `cloud-placement-${asset.id}`,
    project_id: "",
    library_asset_id: asset.id,
    name: asset.name,
    format: asset.format,
    position: 0,
    visible: true,
    download_url: asset.download_url!,
    translation: hit.position,
    rotation_deg: asset.default_rotation_deg,
    scale: asset.default_scale,
    offset: asset.default_offset,
  };
}
