"use client";

import { useGetCompiledTrajectory } from "@/shared/api/generated/client";
import type { CompiledTrajectory } from "@/entities/trajectory/model/types";

export function useCompiledTrajectoryQuery(projectId: string) {
  return useGetCompiledTrajectory(projectId, {
    query: { select: (response) => response.data as CompiledTrajectory },
  });
}
