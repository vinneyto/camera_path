import { Suspense } from "react";

import type { LibraryAsset, ProjectCloud } from "@/shared/api/generated/model";
import type { SceneSurfaceHit } from "@/shared/scene-surface";

import { ProjectCloudSurface } from "./project-cloud-surface";
import { SurfaceTargetRing } from "./surface-target-ring";

export function CloudPlacementPreview({
  asset,
  hit,
}: {
  asset: LibraryAsset;
  hit: SceneSurfaceHit;
}) {
  if (!asset.download_url) return null;
  const cloud: ProjectCloud = {
    id: `cloud-placement-${asset.id}`,
    project_id: "",
    library_asset_id: asset.id,
    name: asset.name,
    position: 0,
    visible: true,
    download_url: asset.download_url,
    translation: hit.position,
    rotation_deg: asset.default_rotation_deg,
    scale: asset.default_scale,
    offset: asset.default_offset,
  };
  return (
    <>
      <Suspense fallback={null}>
        <SurfaceTargetRing position={hit.position} />
      </Suspense>
      <ProjectCloudSurface cloud={cloud} raycastable={false} />
    </>
  );
}
