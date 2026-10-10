import { useMemo } from "react";
import { MathUtils } from "three";

import type { ProjectCloud } from "@/shared/api/generated/model";
import { SceneSurface } from "@/shared/scene-surface";
import type { SceneSurfaceProps } from "@/shared/scene-surface/model/scene-surface-types";

import { transformProjectCloudBounds } from "./transform-project-cloud-bounds";

interface ProjectCloudSurfaceProps extends Omit<SceneSurfaceProps, "source"> {
  cloud: ProjectCloud;
}

export function ProjectCloudSurface({
  cloud,
  resourceKey,
  onReady,
  ...props
}: ProjectCloudSurfaceProps) {
  // Keep the source stable so editing another part of the scene does not reload the file.
  const source = useMemo(
    () => ({
      kind: "url" as const,
      url: cloud.download_url,
      format: cloud.format,
    }),
    [cloud.download_url, cloud.format],
  );
  function handleReady(surface: Parameters<NonNullable<typeof onReady>>[0]) {
    onReady?.({ bounds: transformProjectCloudBounds(surface.bounds, cloud) });
  }
  return (
    <group
      position={cloud.translation}
      rotation={
        cloud.rotation_deg.map(MathUtils.degToRad) as [number, number, number]
      }
      scale={cloud.scale}
      visible={cloud.visible}
    >
      <SceneSurface
        {...props}
        name={cloud.id}
        resourceKey={resourceKey}
        position={cloud.offset}
        onReady={handleReady}
        source={source}
      />
    </group>
  );
}
