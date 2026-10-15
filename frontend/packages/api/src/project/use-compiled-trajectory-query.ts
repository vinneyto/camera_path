"use client";
import { useGetCompiledTrajectory } from "@camera-path/api/client/generated/client";
import type { CompiledTrajectory } from "@camera-path/types/trajectory";

export function useCompiledTrajectoryQuery(projectId: string) {
  return useGetCompiledTrajectory(projectId, {
    query: { select: (response) => response.data as CompiledTrajectory },
  });
}
