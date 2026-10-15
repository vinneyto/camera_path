"use client";
import { useProjectId } from "@camera-path/store";
import type { CompiledTrajectory } from "@camera-path/types/trajectory";
import { useGetCompiledTrajectory } from "../client/generated/client";
export function useCompiledTrajectoryResource(id?: string) {
  const query = useGetCompiledTrajectory(useProjectId(id));
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
        ? { ...query.data, data: query.data.data as CompiledTrajectory }
        : undefined,
  };
}
