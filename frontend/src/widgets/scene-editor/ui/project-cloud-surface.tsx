import { useMemo } from "react";

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
    <SceneSurface
      {...props}
      name={cloud.id}
      source={source}
      visible={cloud.visible}
    />
  );
}
