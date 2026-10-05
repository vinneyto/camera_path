import type { ProjectCloud } from "@/shared/api/generated/model";
import type { PlacementPreview } from "./use-cloud-placement-interaction";

export function createPlacementPreviewCloud({
  asset,
  hit,
}: PlacementPreview): ProjectCloud {
  return {
    id: `cloud-placement-${asset.id}`,
    project_id: "",
    library_asset_id: asset.id,
    name: asset.name,
    position: 0,
    visible: true,
    download_url: asset.download_url!,
    translation: hit.position,
    rotation_deg: asset.default_rotation_deg,
    scale: asset.default_scale,
    offset: asset.default_offset,
  };
}
