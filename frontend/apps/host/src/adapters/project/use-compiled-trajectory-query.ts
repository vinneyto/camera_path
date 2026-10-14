"use client";
import type { CompiledTrajectory } from "@camera-path/contracts/trajectory";
import { useGetCompiledTrajectory } from "@host/adapters/api/generated/client";

export function useCompiledTrajectoryQuery(projectId: string) {
  return useGetCompiledTrajectory(projectId, {
    query: { select: (response) => response.data as CompiledTrajectory },
  });
}
