import { useMemo, useState } from "react";
import { Euler, MathUtils, Matrix4, Quaternion, Vector3 } from "three";

import type { ProjectCloud } from "@/shared/api/generated/model";
import {
  SceneSurface,
  type GaussianCloudLoadProgress,
} from "@/shared/scene-surface";
import type { SceneSurfaceProps } from "@/shared/scene-surface/model/scene-surface-types";

import { CloudLoadingRing } from "./cloud-loading-ring";
import { transformProjectCloudBounds } from "./transform-project-cloud-bounds";

interface ProjectCloudSurfaceProps extends Omit<SceneSurfaceProps, "source"> {
  cloud: ProjectCloud;
}

export function ProjectCloudSurface({
  cloud,
  resourceKey,
  onReady,
  onLoading,
  onError,
  onProgress,
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
  const [load, setLoad] = useState<{
    source: typeof source;
    status: "loading" | "ready" | "error";
    progress: GaussianCloudLoadProgress | null;
  } | null>(null);
  const loading = load?.source !== source || load.status === "loading";
  // Stable identity is required by the cloud resource effect, not by rendering.
  const initialWorldMatrix = useMemo(
    () =>
      new Matrix4()
        .compose(
          new Vector3(...cloud.translation),
          new Quaternion().setFromEuler(
            new Euler(
              ...(cloud.rotation_deg.map(MathUtils.degToRad) as [
                number,
                number,
                number,
              ]),
            ),
          ),
          new Vector3(cloud.scale, cloud.scale, cloud.scale),
        )
        .multiply(new Matrix4().makeTranslation(...cloud.offset))
        .toArray(),
    [cloud.translation, cloud.rotation_deg, cloud.scale, cloud.offset],
  );
  function handleReady(surface: Parameters<NonNullable<typeof onReady>>[0]) {
    setLoad({ source, status: "ready", progress: null });
    onReady?.({ bounds: transformProjectCloudBounds(surface.bounds, cloud) });
  }
  return (
    <>
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
          initialWorldMatrix={initialWorldMatrix}
          onLoading={() => {
            setLoad({ source, status: "loading", progress: null });
            onLoading?.();
          }}
          onProgress={(progress) => {
            setLoad((current) => ({
              source,
              status:
                current?.source === source && current.status === "ready"
                  ? "ready"
                  : "loading",
              progress,
            }));
            onProgress?.(progress);
          }}
          onError={(error) => {
            setLoad({ source, status: "error", progress: null });
            onError?.(error);
          }}
          onReady={handleReady}
          source={source}
        />
      </group>
      {loading && cloud.visible && (
        <CloudLoadingRing
          position={cloud.translation}
          progress={load?.source === source ? load.progress : null}
        />
      )}
    </>
  );
}
