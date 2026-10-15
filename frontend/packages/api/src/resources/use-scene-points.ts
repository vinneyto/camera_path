"use client";
import { useProjectId } from "@camera-path/store";
import type { ScenePoint } from "@camera-path/types/project";
import { useListScenePoints } from "../client/generated/client";
export function useScenePoints(id?: string) {
  const query = useListScenePoints(useProjectId(id));
  return {
    ...query,
    error:
      query.error instanceof Error
        ? query.error
        : query.error
          ? new Error(String(query.error))
          : null,
    data:
      query.data?.status === 200
        ? { ...query.data, data: query.data.data as ScenePoint[] }
        : undefined,
  };
}
