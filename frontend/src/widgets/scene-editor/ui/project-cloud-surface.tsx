import { useMemo } from "react";
import { MathUtils } from "three";

import type { ProjectCloud } from "@/shared/api/generated/model";
import { SceneSurface } from "@/shared/scene-surface";
import type { SceneSurfaceProps } from "@/shared/scene-surface/model/scene-surface-types";

interface ProjectCloudSurfaceProps extends Omit<SceneSurfaceProps, "source"> {
  cloud: ProjectCloud;
}

export function ProjectCloudSurface({
  cloud,
  ...props
}: ProjectCloudSurfaceProps) {
  // Keep the source stable so editing another part of the scene does not reload the file.
  const source = useMemo(
    () => ({ kind: "url" as const, url: cloud.download_url }),
    [cloud.download_url],
  );
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
        position={cloud.offset}
        source={source}
      />
    </group>
  );
}
